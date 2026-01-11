const mongoose = require("mongoose");
const Subscription = require("../models/Subscription");
const FestivalYear = require("../models/FestivalYear");
const Membership = require("../models/Membership"); // Added missing import
const { logAction } = require("../utils/auditLogger");
const { toClient } = require("../utils/mongooseMoney");

// ==========================================
// HELPER: Recalculate Totals (The Fix)
// ==========================================
const recalculateTotals = (subDoc) => {
    let calculatedTotalPaid = 0;
    let calculatedTotalDue = 0;

    if (subDoc.installments && subDoc.installments.length > 0) {
        subDoc.installments.forEach(inst => {
            // 1. Get the value safely (Handle Mongoose Doc vs Plain Object)
            // We use .get() with getters: true to ensure we get "Rupees" (Float) 
            // because the Schema Setter will convert it back to Paise (Int) on save.
            let val;
            if (typeof inst.get === 'function') {
                val = inst.get('amountExpected', null, { getters: true });
            } else {
                val = inst.amountExpected;
            }

            // 2. FORCE Number type (Fixes the NaN crash)
            const safeAmount = Number(val);
            const finalAmount = isNaN(safeAmount) ? 0 : safeAmount;

            if (inst.isPaid) {
                calculatedTotalPaid += finalAmount;
            } else {
                calculatedTotalDue += finalAmount;
            }
        });
    }

    // 3. Assign Result (Mongoose Setter will run here: Rupees -> Paise)
    subDoc.totalPaid = calculatedTotalPaid;
    subDoc.totalDue = calculatedTotalDue;
    
    return subDoc;
};
// ==========================================
// CONTROLLERS
// ==========================================

exports.getMemberSubscription = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { clubId } = req.user;

    const memberShip = await Membership.findById(memberId).populate("user");
    if (!memberShip) return res.status(404).json({ message: "Member not found" });

    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });

    // 1. Handle No Active Year (Return Empty Structure)
    if (!activeYear) {
        return res.json({
            success: true,
            data: {
                member: {
                    memberName: memberShip.user.name,
                    email: memberShip.user.email,
                    personalEmail: memberShip.user.personalEmail,
                    phone: memberShip.user.phone,
                    role: memberShip.role,
                    userId: memberShip.user._id,
                    joinedAt: memberShip.joinedAt
                },
                subscription: null,
                year: null
            }
        });
    }

    // 2. Find Existing Subscription
    let sub = await Subscription.findOne({ 
      club: clubId, 
      year: activeYear._id, 
      member: memberId 
    });

    const targetAmountInt = activeYear.get('amountPerInstallment', null, { getters: false }) || 0;
    const targetCount = activeYear.totalInstallments || 52;

    // 3. Generate Virtual Subscription (Preview) if none exists
    if (!sub) {
      const installments = [];
      for (let i = 1; i <= targetCount; i++) {
        installments.push({
          number: i,
          amountExpected: targetAmountInt, 
          isPaid: false
        });
      }
      
      sub = {
        _id: null, 
        totalPaid: 0,
        totalDue: targetCount * targetAmountInt,
        installments: installments
      };
    }

    // 4. Format for Client
    // Detect if 'sub' is a Mongoose Doc or a plain Object (Virtual)
    const isDoc = typeof sub.get === 'function';
    const getRaw = (obj, field) => isDoc ? obj.get(field, null, { getters: false }) : obj[field];

    const formattedSub = {
        _id: sub._id,
        totalPaid: toClient(getRaw(sub, 'totalPaid')),
        totalDue: toClient(getRaw(sub, 'totalDue')),
        installments: sub.installments.map(inst => ({
            number: inst.number,
            isPaid: inst.isPaid,
            paidDate: inst.paidDate,
            // Handle nested getter for amountExpected
            amountExpected: toClient(isDoc ? inst.get('amountExpected', null, { getters: false }) : inst.amountExpected)
        }))
    };

    res.json({
      success: true,
      data: {
        subscription: formattedSub,
        member: {
            memberName: memberShip.user.name,
            email: memberShip.user.email,
            personalEmail: memberShip.user.personalEmail,
            phone: memberShip.user.phone, 
            role: memberShip.role,        
            userId: memberShip.user._id,
            joinedAt: memberShip.joinedAt  
        },
        year: {
            name: activeYear.name,
            frequency: activeYear.subscriptionFrequency,
            amountPerInstallment: toClient(targetAmountInt),
        }
      }
    });

  } catch (err) {
    console.error("Get Member Sub Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @desc Pay/Undo Installment (Fixed: Recalculates Totals)
 * @route POST /api/v1/subscriptions/pay
 */
exports.payInstallment = async (req, res) => {
  let session;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const { subscriptionId, installmentNumber, memberId } = req.body;
    const { clubId, id: adminUserId } = req.user;

    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true }).session(session);
    if (!activeYear) throw new Error("No active festival year found.");
    if (activeYear.isClosed) throw new Error("Current year is closed for transactions.");

    // 1. Fetch Subscription
    let subDoc = null;
    if (subscriptionId) {
        subDoc = await Subscription.findById(subscriptionId).session(session);
    }

    // 2. Auto-Create if Missing (First Payment Logic)
    if (!subDoc) {
        if (!memberId) throw new Error("First payment requires Member ID.");
        
        subDoc = await Subscription.findOne({ 
            club: clubId, 
            year: activeYear._id, 
            member: memberId 
        }).session(session);

        if (!subDoc) {
            // Get raw integer (Paise) -> Convert to Rupees (Float)
            const targetAmountInt = activeYear.get('amountPerInstallment', null, { getters: false }) || 0;
            const targetAmountRupees = targetAmountInt / 100;
            
            const installments = [];
            for (let i = 1; i <= activeYear.totalInstallments; i++) {
                installments.push({ 
                    number: i, 
                    amountExpected: targetAmountRupees, 
                    isPaid: false 
                });
            }

            const newSubs = await Subscription.create([{
                club: clubId,
                year: activeYear._id,
                member: memberId,
                totalPaid: 0,
                totalDue: (activeYear.totalInstallments * targetAmountRupees),
                installments: installments
            }], { session });
            
            subDoc = newSubs[0];
        }
    }

    // 3. Find the Installment
    const instIndex = subDoc.installments.findIndex(i => i.number === parseInt(installmentNumber));
    if (instIndex === -1) throw new Error(`Installment #${installmentNumber} not found.`);
    
    const installment = subDoc.installments[instIndex];
    const isCurrentlyPaid = installment.isPaid;
    let auditAction = ""; 

    // 4. Toggle Status & Update Data
    if (isCurrentlyPaid) {
        // === UNDO ===
        auditAction = "SUBSCRIPTION_UNDO";
        installment.isPaid = false;
        installment.paidDate = null;
        installment.collectedBy = null;
        
        // When undoing, reset the expected amount to the CURRENT Year's price
        // This handles cases where price increased after they paid
        const currentYearPriceRaw = activeYear.get('amountPerInstallment', null, { getters: false }) || 0;
        installment.amountExpected = currentYearPriceRaw / 100;

    } else {
        // === PAY ===
        auditAction = "SUBSCRIPTION_PAY";
        installment.isPaid = true;
        installment.paidDate = new Date();
        installment.collectedBy = adminUserId;
    }

    // 5. CRITICAL FIX: Run the Robust Recalculation
    recalculateTotals(subDoc);

    // 6. Save
    subDoc.markModified('installments');
    await subDoc.save({ session });

    // 7. Audit Log
    await subDoc.populate({ path: "member", populate: { path: "user", select: "name" } });
    const memberName = subDoc.member?.user?.name || "Unknown Member";
    
    // Helper to get raw log amount
    let logAmount = 0;
    if (typeof installment.get === 'function') {
        logAmount = installment.get('amountExpected', null, { getters: true });
    } else {
        logAmount = installment.amountExpected;
    }

    await logAction({
        req,
        action: auditAction,
        target: `${memberName} - Inst #${installmentNumber}`,
        details: {
            subscriptionId: subDoc._id,
            installment: installmentNumber,
            memberName: memberName,
            amount: logAmount,
            status: auditAction === "SUBSCRIPTION_PAY" ? "Paid" : "Reverted",
            newTotalPaid: subDoc.totalPaid,
            newTotalDue: subDoc.totalDue
        },
        session 
    });

    // 8. Return Fresh Data
    const updatedSub = await Subscription.findById(subDoc._id)
        .populate("year")
        .populate("member", "name")
        .session(session);

    await session.commitTransaction();
    session.endSession();

    res.json({
        success: true,
        message: isCurrentlyPaid ? "Payment undone" : "Payment successful",
        data: updatedSub
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
exports.getAllPayments = async (req, res) => {
  try {
    const { clubId } = req.user;

    const payments = await Subscription.aggregate([
      { $match: { club: new mongoose.Types.ObjectId(clubId) } },
      { $unwind: "$installments" },
      { $match: { "installments.isPaid": true } },
      
      // Lookup Member
      {
        $lookup: {
          from: "memberships", 
          localField: "member",
          foreignField: "_id",
          as: "memberDetails"
        }
      },
      { $unwind: "$memberDetails" },
      
      // Lookup User (for Name)
      {
        $lookup: {
            from: "users",
            localField: "memberDetails.user",
            foreignField: "_id",
            as: "userDetails"
        }
      },
      { $unwind: "$userDetails" },
      
      

      { $sort: { "installments.paidDate": -1 } },
      {
        $project: {
          _id: "$installments._id", 
          subscriptionId: "$_id",
          memberName: "$userDetails.name",
          installmentNumber: "$installments.number",
          // Convert Paise to Rupees for Client
          amount: { $divide: ["$installments.amountExpected", 100] }, 
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