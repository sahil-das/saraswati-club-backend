const MemberFee = require("../models/MemberFee");
const FestivalYear = require("../models/FestivalYear");
const Membership = require("../models/Membership");
const { logAction } = require("../utils/auditLogger");
/**
 * @route POST /api/v1/member-fees
 * @desc Record a payment (Chanda)
 */
exports.createPayment = async (req, res) => {
  try {
    const { userId, amount, notes } = req.body;
    const { clubId, id: adminId, role } = req.user;

    // ✅ AUTH CHECK: Only Admins can collect money
    if (role !== 'admin') {
      return res.status(403).json({ message: "Access denied. Admins only." });
    }

    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) return res.status(404).json({ message: "No active festival year." });

    const fee = await MemberFee.create({
      club: clubId,
      year: activeYear._id,
      user: userId,
      amount,
      collectedBy: adminId,
      notes
    });
  
    // ✅ LOG THE ACTION
    await logAction({
      req,
      action: "PAYMENT_COLLECTED",
      target: `User ID: ${userId}`,
      details: { amount: amount, notes: notes }
    });
    
    res.status(201).json({ success: true, message: "Payment recorded", data: fee });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
/**
 * @route GET /api/v1/member-fees
 * @desc Get raw list of transactions (for history/logs)
 */
exports.getAllFees = async (req, res) => {
  try {
    const { clubId } = req.user;
    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) return res.status(404).json({ message: "No active year." });

    const fees = await MemberFee.find({ club: clubId, year: activeYear._id })
      .populate("user", "name email")
      .populate("collectedBy", "name")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: fees });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @route GET /api/v1/member-fees/summary
 * @desc Get All Members with their Total Paid status (For Collection Matrix)
 */
exports.getFeeSummary = async (req, res) => {
  try {
    const { clubId } = req.user;

    // 1. Active Year
    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) return res.status(400).json({ message: "No active festival year." });

    // 2. Get All Members
    const memberships = await Membership.find({ club: clubId }).populate("user", "name email phone");
    
    // 3. Aggregate Fees for this Year
    const fees = await MemberFee.aggregate([
      { $match: { club: clubId, year: activeYear._id } },
      { $group: { 
          _id: "$user", 
          totalPaid: { $sum: "$amount" },
          lastPaidAt: { $max: "$createdAt" },
          count: { $sum: 1 }
        } 
      }
    ]);

    // 4. Map Fees to Members
    const feeMap = {};
    fees.forEach(f => { feeMap[f._id.toString()] = f; });

    const summary = memberships.map(m => {
        const userId = m.user._id.toString();
        const feeData = feeMap[userId];
        return {
            memberId: userId,
            name: m.user.name,
            email: m.user.email,
            totalPaid: feeData?.totalPaid || 0,
            lastPaidAt: feeData?.lastPaidAt || null,
            transactionCount: feeData?.count || 0
        };
    });

    // Sort: Unpaid first, then by Name
    summary.sort((a, b) => {
        if (a.totalPaid === 0 && b.totalPaid > 0) return -1;
        if (a.totalPaid > 0 && b.totalPaid === 0) return 1;
        return a.name.localeCompare(b.name);
    });

    res.json({ success: true, data: summary });

  } catch (err) {
    console.error("Fee Summary Error:", err);
    res.status(500).json({ message: "Server error fetching summary" });
  }
};

/**
 * @route DELETE /api/v1/member-fees/:id
 */
exports.deletePayment = async (req, res) => {
  try {
    const fee = await MemberFee.findOneAndDelete({ _id: req.params.id, club: req.user.clubId });
    if (!fee) return res.status(404).json({ message: "Record not found" });
    res.json({ success: true, message: "Record deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};


// ✅ NEW: Get fees for a specific member (for MemberDetails page)
exports.getMemberFees = async (req, res) => {
  try {
    const { userId } = req.params;
    const { clubId } = req.user;

    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) return res.status(404).json({ message: "No active year" });

    const fees = await MemberFee.find({ 
      club: clubId, 
      year: activeYear._id,
      user: userId 
    }).populate("collectedBy", "name");

    const total = fees.reduce((sum, f) => sum + f.amount, 0);

    res.json({ 
      success: true, 
      data: {
        total,
        records: fees
      } 
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};