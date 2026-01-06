const MemberFee = require("../models/MemberFee");
const FestivalYear = require("../models/FestivalYear");
const Membership = require("../models/Membership");
const User = require("../models/User");
const { logAction } = require("../utils/auditLogger");

exports.createPayment = async (req, res) => {
  try {
    const { userId, amount, notes } = req.body;
    const { clubId, id: adminId, role } = req.user;

    if (role !== 'admin') return res.status(403).json({ message: "Admins only." });

    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) return res.status(404).json({ message: "No active festival year." });

    const userObj = await User.findById(userId);
    const memberName = userObj ? userObj.name : "Unknown Member";

    const fee = await MemberFee.create({
      club: clubId,
      year: activeYear._id,
      user: userId,
      amount,
      collectedBy: adminId,
      notes
    });
  
    await logAction({
      req,
      action: "PAYMENT_COLLECTED",
      target: `Chanda: ${memberName}`,
      details: { amount: amount, notes: notes }
    });
    
    res.status(201).json({ success: true, message: "Payment recorded", data: fee });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

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
 * @desc Get All Members with their Total Paid status
 * ✅ FIX: Aggregation returns Paise, needs conversion
 */
exports.getFeeSummary = async (req, res) => {
  try {
    const { clubId } = req.user;

    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) return res.status(400).json({ message: "No active festival year." });

    const memberships = await Membership.find({ club: clubId }).populate("user", "name email phone");
    
    // Aggregation returns RAW INTEGERS (Paise)
    const fees = await MemberFee.aggregate([
      { $match: { club: clubId, year: activeYear._id } },
      { $group: { 
          _id: "$user", 
          totalPaid: { $sum: "$amount" }, // 👈 Raw Paise (e.g. 5050)
          lastPaidAt: { $max: "$createdAt" },
          count: { $sum: 1 }
        } 
      }
    ]);

    const feeMap = {};
    fees.forEach(f => { feeMap[f._id.toString()] = f; });

    const summary = memberships.map(m => {
        const userId = m.user._id.toString();
        const feeData = feeMap[userId];
        
        // ✅ FIX: Divide by 100 to convert Paise to Rupees
        const rawTotal = feeData?.totalPaid || 0;
        const finalTotal = rawTotal / 100;

        return {
            memberId: userId,
            name: m.user.name,
            email: m.user.email,
            totalPaid: finalTotal,
            lastPaidAt: feeData?.lastPaidAt || null,
            transactionCount: feeData?.count || 0
        };
    });

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

exports.deletePayment = async (req, res) => {
  try {
    const fee = await MemberFee.findOne({ _id: req.params.id, club: req.user.clubId })
      .populate("user", "name");

    if (!fee) return res.status(404).json({ message: "Record not found" });

    await MemberFee.findByIdAndDelete(fee._id);

    await logAction({
      req,
      action: "PAYMENT_DELETED",
      target: `Deleted Chanda: ${fee.user?.name || "Unknown User"}`,
      details: { amount: fee.amount, originalDate: fee.createdAt }
    });

    res.json({ success: true, message: "Record deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

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

    // Mongoose documents handle the conversion, but reducing logic needs care
    const total = fees.reduce((sum, f) => sum + Number(f.amount), 0);

    res.json({ 
      success: true, 
      data: {
        total,
        records: fees
      } 
    });

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};