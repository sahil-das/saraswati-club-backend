const MemberFee = require("../models/MemberFee");
const FestivalYear = require("../models/FestivalYear");
const Membership = require("../models/Membership");
const User = require("../models/User"); 
const { logAction } = require("../utils/auditLogger");
const { toClient } = require("../utils/mongooseMoney"); // 👈 Ensure this is imported
const mongoose = require("mongoose");
/**
 * @route POST /api/v1/member-fees
 * @desc Record a payment (Chanda)
 */
exports.createPayment = async (req, res) => {
  try {
    const { userId: passedId, amount, notes } = req.body;
    const { clubId, id: adminId, role } = req.user;

    // ✅ 1. Input Validation (Stop "undefined" errors here)
    if (!passedId || passedId === "undefined") {
        return res.status(400).json({ message: "Member ID is required." });
    }

    if (role !== 'admin') {
      return res.status(403).json({ message: "Access denied. Admins only." });
    }

    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) return res.status(404).json({ message: "No active festival year." });

    // ✅ 2. Resolve Real User
    let realUserId = passedId;
    let memberName = "Unknown Member";

    // Check if it's a valid ObjectId to prevent CastErrors during lookup
    if (!mongoose.Types.ObjectId.isValid(passedId)) {
        return res.status(400).json({ message: "Invalid Member ID format" });
    }

    // Attempt to find Membership first
    const membership = await Membership.findById(passedId).populate("user");

    if (membership && membership.user) {
        realUserId = membership.user._id;
        memberName = membership.user.name;
    } else {
        // Fallback: Check if it's a direct User ID
        const userObj = await User.findById(passedId);
        if (userObj) {
            memberName = userObj.name;
            realUserId = userObj._id;
        } else {
            return res.status(404).json({ message: "Member not found" });
        }
    }

    // ✅ 3. Create Fee (Now guaranteed to have a valid User ID)
    const fee = await MemberFee.create({
      club: clubId,
      year: activeYear._id,
      user: realUserId, 
      amount, 
      collectedBy: adminId,
      notes
    });
  
    // ✅ LOG THE ACTION
    await logAction({
      req,
      action: "PAYMENT_COLLECTED",
      target: `Chanda: ${memberName}`,
      details: { amount: amount, notes: notes }
    });
    
    // 💰 FORMAT RESPONSE
    const feeObj = fee.toObject();
    
    // Manually attach the name so frontend displays it immediately
    feeObj.memberName = memberName; 
    
    // Fix Amount (Paisa -> Rupees)
    feeObj.amount = toClient(fee.get('amount', null, { getters: false }));

    res.status(201).json({ success: true, message: "Payment recorded", data: feeObj });

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

    // 💰 FIX: Format all records to Rupees string
    const formattedFees = fees.map(f => {
        const obj = f.toObject();
        obj.amount = toClient(f.get('amount', null, { getters: false }));
        return obj;
    });

    res.json({ success: true, data: formattedFees });
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
    // We need this list to show rows for people who haven't paid anything yet
    const memberships = await Membership.find({ club: clubId }).populate("user", "name email phone");
    
    // 3. Aggregate Fees for this Year
    const fees = await MemberFee.aggregate([
      { 
        $match: { 
            // ⚠️ FIX: Cast String to ObjectId
            club: new mongoose.Types.ObjectId(clubId), 
            year: activeYear._id 
        } 
      },
      { 
        $group: { 
          _id: "$user", // Group by User ID
          totalPaid: { $sum: "$amount" }, // Sum of Integer Paise
          lastPaidAt: { $max: "$createdAt" },
          count: { $sum: 1 }
        } 
      }
    ]);

    // 4. Map Fees to Members
    const feeMap = {};
    fees.forEach(f => { 
        // Ensure we handle null IDs gracefully
        if(f._id) feeMap[f._id.toString()] = f; 
    });

    const summary = memberships.map(m => {
        // Safety check: ensure user object exists (in case of broken DB references)
        if (!m.user) return null; 

        const userId = m.user._id.toString();
        const feeData = feeMap[userId];
        const rawTotal = feeData?.totalPaid || 0; // Integer value

        return {
            memberId: userId, // Returning User ID (consistent with frontend expectation?)
            // OR if frontend needs Membership ID: memberId: m._id,
            name: m.user.name,
            email: m.user.email,
            // 💰 Format Integer to String "50.00"
            totalPaid: toClient(rawTotal), 
          
            lastPaidAt: feeData?.lastPaidAt || null,
            transactionCount: feeData?.count || 0
        };
    }).filter(Boolean); // Remove nulls

    // Sort: Unpaid/Zero first, then by Name
    summary.sort((a, b) => {
        if (a.rawTotal === 0 && b.rawTotal > 0) return -1;
        if (a.rawTotal > 0 && b.rawTotal === 0) return 1;
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
    // 1. Find the fee first (so we can log what we are deleting)
    const fee = await MemberFee.findOne({ _id: req.params.id, club: req.user.clubId })
      .populate("user", "name"); 

    if (!fee) return res.status(404).json({ message: "Record not found" });

    // 2. Delete it
    await MemberFee.findByIdAndDelete(fee._id);

    // ✅ LOG THE DELETION
    await logAction({
      req,
      action: "PAYMENT_DELETED",
      target: `Deleted Chanda: ${fee.user?.name || "Unknown User"}`,
      details: { 
        amount: fee.amount, // Log logic usually handles string/number fine
        originalDate: fee.createdAt 
      }
    });

    res.json({ success: true, message: "Record deleted" });
  } catch (err) {
    console.error(err); 
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ NEW: Get fees for a specific member (for MemberDetails page)
exports.getMemberFees = async (req, res) => {
  try {
    const { userId } = req.params;
    const { clubId } = req.user;
    
    // ✅ FIX: Guard against "undefined" string or invalid IDs
    if (!userId || userId === "undefined" || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: "Invalid User ID provided" });
    }

    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) return res.status(404).json({ message: "No active year" });

    // Fetch records
    const fees = await MemberFee.find({ 
      club: clubId, 
      year: activeYear._id,
      user: userId 
    }).populate("collectedBy", "name");

    // 💰 Fix: Calculate Total from Raw Integers to avoid string concatenation
    const totalInt = fees.reduce((sum, f) => {
      // Access raw value to avoid "50.00" + "50.00" = "50.0050.00"
      const rawAmount = f.get('amount', null, { getters: false }) || 0;
      return sum + rawAmount;
    }, 0);

    // 💰 Fix: Format records too
    const formattedRecords = fees.map(f => {
        const obj = f.toObject();
        obj.amount = toClient(f.get('amount', null, { getters: false }));
        return obj;
    });

    res.json({ 
      success: true, 
      data: {
        total: toClient(totalInt), // Format to "100.00"
        records: formattedRecords
      } 
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};