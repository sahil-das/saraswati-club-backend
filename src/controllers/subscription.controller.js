const Subscription = require("../models/Subscription");
const FestivalYear = require("../models/FestivalYear");
const Membership = require("../models/Membership");
const { logAction } = require("../utils/auditLogger");
const { toClient } = require("../utils/mongooseMoney"); // 👈 IMPORT THIS
const mongoose = require("mongoose");
/**
 * @desc Get Subscription Card (READ-ONLY FIX)
 * @route GET /api/v1/subscriptions/member/:memberId
 */
exports.getMemberSubscription = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { clubId } = req.user;

    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) return res.status(400).json({ message: "No active year found." });

    const memberShip = await Membership.findById(memberId).populate("user");
    if (!memberShip) return res.status(404).json({ message: "Member not found" });

    let sub = await Subscription.findOne({ 
      club: clubId, 
      year: activeYear._id, 
      member: memberId 
    });

    const targetAmountInt = activeYear.get('amountPerInstallment', null, { getters: false }) || 0;
    const targetCount = activeYear.totalInstallments || 52;

    // VIRTUAL PREVIEW (If no sub exists, generate object in memory only)
    if (!sub) {
      const installments = [];
      for (let i = 1; i <= targetCount; i++) {
        installments.push({
          number: i,
          amountExpected: targetAmountInt, // Raw Int
          isPaid: false
        });
      }
      
      // Create a temporary object structure (Not Mongoose Document)
      sub = {
        _id: null, // No ID yet
        totalPaid: 0,
        totalDue: targetCount * targetAmountInt,
        installments: installments
      };
    }

    // Format for Client
    // Note: If sub is a Mongoose doc, use .get(). If plain object, use direct access.
    const isDoc = typeof sub.get === 'function';
    
    // Helper to get raw values safely (whether Doc or Object)
    const getRaw = (obj, field) => {
        return isDoc ? obj.get(field, null, { getters: false }) : obj[field];
    };

    const formattedSub = {
        _id: sub._id,
        // toClient (from your util) divides by 100, so we pass raw Integers
        totalPaid: toClient(getRaw(sub, 'totalPaid')),
        totalDue: toClient(getRaw(sub, 'totalDue')),
        installments: sub.installments.map(inst => ({
            number: inst.number,
            isPaid: inst.isPaid,
            paidDate: inst.paidDate,
            amountExpected: toClient(isDoc ? inst.get('amountExpected', null, { getters: false }) : inst.amountExpected)
        }))
    };

    res.json({
      success: true,
      data: {
        subscription: formattedSub,
        memberName: memberShip.user.name,
        
        // ✅ CRITICAL FIX: Send the User ID so frontend can fetch fees
        memberUserId: memberShip.user._id,
        

        rules: {
          name: activeYear.name,
          frequency: activeYear.subscriptionFrequency,
          amount: toClient(targetAmountInt)
        }
      }
    });

  } catch (err) {
    console.error("Subscription Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};
/**
 * @desc Pay Installment (Robust NaN Fix)
 * @route POST /api/v1/subscriptions/pay
 */
exports.payInstallment = async (req, res) => {
  let session;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const { subscriptionId, installmentNumber, memberId } = req.body;
    const { clubId, id: adminUserId } = req.user;

    // 1. Get Active Year
    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) throw new Error("No active festival year found.");

    // 2. Resolve Subscription
    let subDoc = null;

    if (subscriptionId) {
        // ✅ POPULATE MEMBER for Audit Logs
        subDoc = await Subscription.findById(subscriptionId)
            .populate("year")
            .populate("member", "name") 
            .session(session);
    }

    // --- CREATE-ON-PAY LOGIC ---
    if (!subDoc) {
        if (!memberId) throw new Error("First payment requires Member ID.");

        subDoc = await Subscription.findOne({ 
            club: clubId, 
            year: activeYear._id, 
            member: memberId 
        })
        .populate("member", "name") // Populate here too
        .session(session);

        if (!subDoc) {
            const targetAmountRupees = activeYear.amountPerInstallment || 0; 
            const installments = [];
            for (let i = 1; i <= activeYear.totalInstallments; i++) {
                installments.push({ 
                    number: i, 
                    amountExpected: targetAmountRupees, 
                    isPaid: false 
                });
            }

            const totalDueRupees = activeYear.totalInstallments * targetAmountRupees;

            const newSubs = await Subscription.create([{
                club: clubId,
                year: activeYear._id,
                member: memberId,
                totalPaid: 0,
                totalDue: totalDueRupees,
                installments: installments
            }], { session });
            
            subDoc = newSubs[0];
            // Manually populate member for the log if we just created it
            await subDoc.populate("member", "name");
        }
    }

    // 3. Find Installment
    const installmentIndex = subDoc.installments.findIndex(i => i.number === parseInt(installmentNumber));
    if (installmentIndex === -1) throw new Error(`Installment #${installmentNumber} not found.`);

    const installment = subDoc.installments[installmentIndex];

    // 4. Raw Values & Toggle Logic
    const amountVal = installment.get('amountExpected', null, { getters: false });
    const currentTotalPaid = subDoc.get('totalPaid', null, { getters: false }) || 0;
    
    // We'll capture the action type for the log
    let auditAction = ""; 

    if (installment.isPaid) {
        // === UNDO PAYMENT ===
        installment.isPaid = false;
        installment.paidDate = null;
        installment.collectedBy = null;
        subDoc.totalPaid = (currentTotalPaid - amountVal) / 100;
        
        auditAction = "SUBSCRIPTION_UNDO";
    } else {
        // === PROCESS PAYMENT ===
        installment.isPaid = true;
        installment.paidDate = new Date();
        installment.collectedBy = adminUserId;
        subDoc.totalPaid = (currentTotalPaid + amountVal) / 100;

        auditAction = "SUBSCRIPTION_PAY";
    }

    await subDoc.save({ session });

    // ✅ 5. AUDIT LOGGING
    // We run this INSIDE the transaction so if logging fails, payment rolls back (optional, but safer)
    await logAction({
        req,
        action: auditAction,
        target: `${subDoc.member?.name || "Member"} - Inst #${installmentNumber}`,
        details: {
            subscriptionId: subDoc._id,
            installment: installmentNumber,
            amountRaw: amountVal, // Log the paisa value
            status: auditAction === "SUBSCRIPTION_PAY" ? "Paid" : "Reverted"
        }
    });

    await session.commitTransaction();
    session.endSession();

    res.json({
        success: true,
        message: installment.isPaid ? "Payment successful" : "Payment undone",
        data: subDoc
    });

  } catch (err) {
    if (session) {
        await session.abortTransaction();
        session.endSession();
    }
    console.error("Payment Error:", err);
    res.status(500).json({ message: err.message || "Payment failed" });
  }
};

/**
 * @desc Get ALL Payments (SCALABILITY FIX)
 * @route GET /api/v1/subscriptions/payments
 */
exports.getAllPayments = async (req, res) => {
  try {
    const { clubId } = req.user;

    const payments = await Subscription.aggregate([
      // 1. Filter: Get subscriptions for this club
      { $match: { club: new mongoose.Types.ObjectId(clubId) } },

      // 2. Unwind: Break the "installments" array into individual documents
      // If a user has 12 installments, this creates 12 temporary docs
      { $unwind: "$installments" },

      // 3. Filter: Keep only the PAID installments
      { $match: { "installments.isPaid": true } },

      // 4. Join: Bring in User details (Name, etc.)
      {
        $lookup: {
          from: "memberships", // Ensure this matches your actual collection name
          localField: "member",
          foreignField: "_id",
          as: "memberDetails"
        }
      },
      // Lookup returns an array, so we flatten it
      { $unwind: "$memberDetails" },
      {
        $lookup: {
            from: "users",
            localField: "memberDetails.user",
            foreignField: "_id",
            as: "userDetails"
        }
      },
      { $unwind: "$userDetails" },

      // 5. Sort: Show most recent payments first
      { $sort: { "installments.paidDate": -1 } },

      // 6. Format: Shape the final output nicely
      {
        $project: {
          _id: "$installments._id", // Unique ID of the installment
          subscriptionId: "$_id",
          memberName: "$userDetails.name",
          installmentNumber: "$installments.number",
          amount: { $divide: ["$installments.amountExpected", 100] }, // Convert Paisa -> Rupees
          date: "$installments.paidDate",
          collectedBy: "$installments.collectedBy"
        }
      }
    ]);

    res.json({
      success: true,
      data: payments
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};