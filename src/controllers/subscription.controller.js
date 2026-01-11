const Subscription = require("../models/Subscription");
const FestivalYear = require("../models/FestivalYear");
const Membership = require("../models/Membership");
const { logAction } = require("../utils/auditLogger");
const { toClient } = require("../utils/mongooseMoney");
const mongoose = require("mongoose");

exports.getMemberSubscription = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { clubId } = req.user;

    const memberShip = await Membership.findById(memberId).populate("user");
    if (!memberShip) return res.status(404).json({ message: "Member not found" });

    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });

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
                year: null,
                rules: null
            }
        });
    }

    let sub = await Subscription.findOne({ 
      club: clubId, 
      year: activeYear._id, 
      member: memberId 
    });

    const targetAmountInt = activeYear.get('amountPerInstallment', null, { getters: false }) || 0;
    const targetCount = activeYear.totalInstallments || 52;

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
 * @desc Pay Installment (FIXED: SAFE MONGOOSE TRANSACTION)
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

    // 1. Fetch or Create Subscription
    let subDoc = null;
    if (subscriptionId) {
        subDoc = await Subscription.findById(subscriptionId).session(session);
    }

    // --- CREATE-ON-PAY LOGIC ---
    if (!subDoc) {
        if (!memberId) throw new Error("First payment requires Member ID.");
        
        // Check if one already exists to avoid duplicates
        subDoc = await Subscription.findOne({ 
            club: clubId, 
            year: activeYear._id, 
            member: memberId 
        }).session(session);

        if (!subDoc) {
            // GET RAW INTEGER (Paise) e.g., 5000
            const targetAmountInt = activeYear.get('amountPerInstallment', null, { getters: false }) || 0;
            
            // CONVERT TO RUPEES (Float) for Creation
            // Reason: Mongoose Setters will run on .create(), so we pass 50.00 -> It stores 5000
            const targetAmountRupees = targetAmountInt / 100;
            const totalDueRupees = (activeYear.totalInstallments * targetAmountInt) / 100;

            const installments = [];
            for (let i = 1; i <= activeYear.totalInstallments; i++) {
                installments.push({ 
                    number: i, 
                    amountExpected: targetAmountRupees, // Setter will x100
                    isPaid: false 
                });
            }

            const newSubs = await Subscription.create([{
                club: clubId,
                year: activeYear._id,
                member: memberId,
                totalPaid: 0,
                totalDue: totalDueRupees,
                installments: installments
            }], { session });
            
            subDoc = newSubs[0];
        }
    }

    // 2. Resolve Installment
    const instIndex = subDoc.installments.findIndex(i => i.number === parseInt(installmentNumber));
    if (instIndex === -1) throw new Error(`Installment #${installmentNumber} not found.`);
    
    const installment = subDoc.installments[instIndex];
    
    // GET RAW INTEGER (Paise) from DB e.g., 5000
    const amountValRaw = installment.get('amountExpected', null, { getters: false });
    
    // CONVERT TO RUPEES for Update
    // Reason: We use runValidators: true, so $inc will trigger the Setter (x100)
    // We pass 50 -> Setter makes it 5000
    const amountInRupees = amountValRaw / 100;

    const isCurrentlyPaid = installment.isPaid;
    let auditAction = ""; 

    if (isCurrentlyPaid) {
        // === UNDO PAYMENT ===
        auditAction = "SUBSCRIPTION_UNDO";
        
        await Subscription.findOneAndUpdate(
            { _id: subDoc._id, "installments.number": parseInt(installmentNumber) },
            { 
                $set: { 
                    "installments.$.isPaid": false,
                    "installments.$.paidDate": null,
                    "installments.$.collectedBy": null
                },
                $inc: { 
                    totalPaid: -amountInRupees, // Pass -50 -> Setter stores -5000
                    totalDue: amountInRupees    // Pass 50 -> Setter stores 5000
                }
            },
            { session, new: true, runValidators: true } 
        );

    } else {
        // === PROCESS PAYMENT ===
        auditAction = "SUBSCRIPTION_PAY";

        await Subscription.findOneAndUpdate(
            { _id: subDoc._id, "installments.number": parseInt(installmentNumber) },
            { 
                $set: { 
                    "installments.$.isPaid": true,
                    "installments.$.paidDate": new Date(),
                    "installments.$.collectedBy": adminUserId 
                },
                $inc: { 
                    totalPaid: amountInRupees, // Pass 50 -> Setter stores 5000
                    totalDue: -amountInRupees  // Pass -50 -> Setter stores -5000
                }
            },
            { session, new: true, runValidators: true }
        );
    }

    // 3. Audit Log
    // We populate only for the log message
    await subDoc.populate({ path: "member", populate: { path: "user", select: "name" } });
    const memberName = subDoc.member?.user?.name || "Unknown Member";
    
    await logAction({
        req,
        action: auditAction,
        target: `${memberName} - Inst #${installmentNumber}`,
        details: {
            subscriptionId: subDoc._id,
            installment: installmentNumber,
            memberName: memberName,
            amount: toClient(amountValRaw), // Display "50.00" in logs
            status: auditAction === "SUBSCRIPTION_PAY" ? "Paid" : "Reverted"
        },
        session // <--- 🚨 CRITICAL: Passing session binds log to transaction
    });

    // 4. Return Fresh Data
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
      {
        $lookup: {
          from: "memberships", 
          localField: "member",
          foreignField: "_id",
          as: "memberDetails"
        }
      },
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
      { $sort: { "installments.paidDate": -1 } },
      {
        $project: {
          _id: "$installments._id", 
          subscriptionId: "$_id",
          memberName: "$userDetails.name",
          installmentNumber: "$installments.number",
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