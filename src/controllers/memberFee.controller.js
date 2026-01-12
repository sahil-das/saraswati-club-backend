const MemberFee = require("../models/MemberFee");
const FestivalYear = require("../models/FestivalYear");
const Membership = require("../models/Membership");
const User = require("../models/User"); 
const { logAction } = require("../utils/auditLogger");
const { toClient } = require("../utils/mongooseMoney");
const mongoose = require("mongoose");

/**
 * @route POST /api/v1/member-fees
 * @desc Record a payment (Chanda) - Uses Membership Standard
 */
exports.createPayment = async (req, res) => {
  let session;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    // passedId can be a User ID (from frontend) or a Membership ID
    const { userId: passedId, amount, notes } = req.body;
    const { clubId, id: adminId, role } = req.user;

    // ✅ 1. Input Validation
    if (!passedId || passedId === "undefined") {
        throw new Error("Member ID is required.");
    }
    if (role !== 'admin') {
        throw new Error("Access denied. Admins only.");
    }

    // ✅ RACE CONDITION FIX: Fetch Year INSIDE Transaction
    const activeYear = await FestivalYear.findOne({ 
        club: clubId, 
        isActive: true,
        isClosed: false 
    }).session(session);

    if (!activeYear) throw new Error("No active festival year found.");

    // ✅ 2. Resolve Membership (The Bridge)
    // This smart query finds the Membership whether the frontend sent a User ID OR a Membership ID
    let membership = await Membership.findOne({ 
        $or: [ 
            { _id: (mongoose.Types.ObjectId.isValid(passedId) ? passedId : null) }, 
            { user: (mongoose.Types.ObjectId.isValid(passedId) ? passedId : null) } 
        ],
        club: clubId 
    }).populate("user").session(session);

    if (!membership || !membership.user) {
        throw new Error("Member not found in this club.");
    }

    const realUserId = membership.user._id;
    const memberName = membership.user.name;

    // ✅ 3. Create Fee (Standardizing on 'member' field)
    const [fee] = await MemberFee.create([{
      club: clubId,
      year: activeYear._id,
      member: membership._id, // 🌟 NEW STANDARD: Link to Membership
      user: realUserId,       // ⚠️ BACKUP: Link to User (for safety)
      amount, 
      collectedBy: adminId,
      notes
    }], { session });
  
    // ✅ LOG THE ACTION
    await logAction({
      req,
      action: "PAYMENT_COLLECTED",
      target: `Chanda: ${memberName}`,
      details: { amount: amount, notes: notes }
    });
    
    await session.commitTransaction();
    session.endSession();
    
    // 💰 FORMAT RESPONSE
    const feeObj = fee.toObject();
    feeObj.memberName = memberName; 
    feeObj.amount = toClient(fee.get('amount', null, { getters: false }));

    res.status(201).json({ success: true, message: "Payment recorded", data: feeObj });

  } catch (err) {
    if (session) {
        await session.abortTransaction();
        session.endSession();
    }
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
};

/**
 * @route GET /api/v1/member-fees
 * @desc Get raw list of transactions (Populated via Membership)
 */
exports.getAllFees = async (req, res) => {
  try {
    const { clubId } = req.user;
    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) return res.status(404).json({ message: "No active year." });

    const fees = await MemberFee.find({ 
        club: clubId, 
        year: activeYear._id,
        isDeleted: false 
    })
      .populate({
          path: "member", // ✅ Link to Membership
          populate: { path: "user", select: "name email" } // ✅ Nested Link to User
      })
      .populate("collectedBy", "name")
      .sort({ createdAt: -1 });

    // 💰 FIX: Format all records to Rupees string
    const formattedFees = fees.map(f => {
        const obj = f.toObject();
        obj.amount = toClient(f.get('amount', null, { getters: false }));
        
        // Flatten structure for Frontend convenience
        // If 'member' exists, pull user details up to top level
        if(f.member && f.member.user) {
            obj.user = f.member.user; 
            obj.memberName = f.member.user.name;
        } else if (f.user) {
             // Fallback for old records without 'member' populated
             // (This requires .populate('user') above if we wanted to support mixed records perfectly, 
             // but strictly speaking we are moving to member)
        }
        
        return obj;
    });

    res.json({ success: true, data: formattedFees });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @route GET /api/v1/member-fees/summary
 * @desc Get All Members with their Total Paid status (Aggregated by Membership)
 */
exports.getFeeSummary = async (req, res) => {
  try {
    const { clubId } = req.user;

    // 1. Active Year
    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) return res.status(400).json({ message: "No active festival year." });

    // 2. Get All Members
    const memberships = await Membership.find({ club: clubId }).populate("user", "name email phone");
    
    // 3. Aggregate Fees by MEMBER ID
    const fees = await MemberFee.aggregate([
      { 
        $match: { 
            club: new mongoose.Types.ObjectId(clubId), 
            year: activeYear._id,
            isDeleted: false 
        } 
      },
      { 
        $group: { 
          _id: "$member", // 🌟 Group by Membership ID
          totalPaid: { $sum: "$amount" },
          lastPaidAt: { $max: "$createdAt" },
          count: { $sum: 1 }
        } 
      }
    ]);

    // 4. Map Fees to Memberships
    const feeMap = {};
    fees.forEach(f => { 
        if(f._id) feeMap[f._id.toString()] = f; 
    });

    const summary = memberships.map(m => {
        if (!m.user) return null; 

        // Match Membership ID directly
        const feeData = feeMap[m._id.toString()];
        const rawTotal = feeData?.totalPaid || 0;

        return {
            memberId: m.user._id, // Return User ID for frontend routing compatibility
            membershipId: m._id,  // Return this too for robust linking
            name: m.user.name,
            email: m.user.email,
            // 💰 Format Integer to String "50.00"
            totalPaid: toClient(rawTotal), 
            lastPaidAt: feeData?.lastPaidAt || null,
            transactionCount: feeData?.count || 0
        };
    }).filter(Boolean);

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
    // 1. Soft Delete the Fee
    const fee = await MemberFee.findOneAndUpdate(
        { _id: req.params.id, club: req.user.clubId },
        { isDeleted: true }, 
        { new: true }
    ).populate({ 
        path: "member", 
        populate: { path: "user", select: "name" } 
    });

    if (!fee) return res.status(404).json({ message: "Record not found" });

    // 2. Log Action
    // Robust name resolution: Try member->user->name, fall back to "Unknown"
    const targetName = fee.member?.user?.name || "Unknown Member";

    await logAction({
      req,
      action: "PAYMENT_DELETED",
      target: `Deleted Chanda: ${targetName}`,
      details: { 
        amount: toClient(fee.get('amount', null, { getters: false })),
        originalDate: fee.createdAt 
      }
    });

    res.json({ success: true, message: "Record deleted" });
  } catch (err) {
    console.error(err); 
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @route GET /api/v1/member-fees/:userId
 * @desc Get fees for a specific member (Resolves User ID to Membership ID first)
 */
exports.getMemberFees = async (req, res) => {
  try {
    const { userId } = req.params; // Frontend likely sends User ID from URL
    const { clubId } = req.user;
    
    if (!userId || userId === "undefined" || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: "Invalid User ID provided" });
    }

    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) return res.status(404).json({ message: "No active year" });

    // 1. Resolve Membership First
    // We need the Membership ID because that's how fees are now linked
    const membership = await Membership.findOne({ user: userId, club: clubId });
    if (!membership) return res.status(404).json({ message: "Member not found" });

    // 2. Fetch records using Membership ID
    const fees = await MemberFee.find({ 
      club: clubId, 
      year: activeYear._id,
      member: membership._id, // 🌟 Query by Membership
      isDeleted: false 
    }).populate("collectedBy", "name");

    // 💰 Calculate Total
    const totalInt = fees.reduce((sum, f) => {
      const rawAmount = f.get('amount', null, { getters: false }) || 0;
      return sum + rawAmount;
    }, 0);

    // 💰 Format records
    const formattedRecords = fees.map(f => {
        const obj = f.toObject();
        obj.amount = toClient(f.get('amount', null, { getters: false }));
        return obj;
    });

    res.json({ 
      success: true, 
      data: {
        total: toClient(totalInt),
        records: formattedRecords
      } 
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};