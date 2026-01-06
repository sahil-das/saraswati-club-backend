const Subscription = require("../models/Subscription");
const FestivalYear = require("../models/FestivalYear");
const Membership = require("../models/Membership");
const User = require("../models/User"); // Added for safety
const { logAction } = require("../utils/auditLogger");

/**
 * @desc Get Subscription Card (Read-Only Version)
 * Does NOT auto-create records to prevent GET-request write side-effects.
 */
exports.getMemberSubscription = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { clubId } = req.user;

    // 1. Get Active Year
    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) return res.status(400).json({ message: "No active year found." });

    // 2. Fetch Membership & User Details
    const memberShip = await Membership.findById(memberId).populate("user");
    if (!memberShip) return res.status(404).json({ message: "Member not found" });

    const memberName = memberShip.user ? memberShip.user.name : "Unknown Member";
    const memberUserId = memberShip.user ? memberShip.user._id : null;

    // 3. Find Subscription (Read Only)
    let sub = await Subscription.findOne({ 
      club: clubId, 
      year: activeYear._id, 
      member: memberId 
    });

    const targetAmount = activeYear.amountPerInstallment || 0;
    const targetCount = activeYear.totalInstallments || 52;
    const totalDueCalc = targetCount * targetAmount;

    // 4. Construct Response Data (Virtual if missing)
    let responseData;

    if (!sub) {
      // Return "Virtual" Subscription for UI display
      const installments = [];
      for (let i = 1; i <= targetCount; i++) {
        installments.push({
          number: i,
          amountExpected: targetAmount,
          isPaid: false
        });
      }
      responseData = {
        _id: null, // Indicates it's not saved yet
        member: memberId,
        installments,
        totalPaid: 0,
        totalDue: totalDueCalc
      };
    } else {
      // Return Existing Data
      responseData = sub;
    }

    res.json({
      success: true,
      data: {
        subscription: responseData,
        memberName: memberName,
        memberUserId: memberUserId,
        rules: {
          name: activeYear.name,
          frequency: activeYear.subscriptionFrequency,
          amount: targetAmount
        }
      }
    });

  } catch (err) {
    console.error("Subscription Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

/**
 * @desc Pay Installment (Atomic / Thread-Safe)
 */
exports.payInstallment = async (req, res) => {
  try {
    const { subscriptionId, installmentNumber, memberId } = req.body;
    const { clubId, id: userId } = req.user;

    // 1. Validate Context
    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) return res.status(400).json({ message: "No active year." });
    if (activeYear.subscriptionFrequency === 'none') {
       return res.status(400).json({ message: "Subscriptions disabled for this year." });
    }
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only Admins can update payments." });
    }

    const amount = activeYear.amountPerInstallment || 0;

    // 2. Ensure Subscription Exists (Lazy Creation)
    // If ID is missing/null, we must find or create the sub first using atomic upsert
    let targetSubId = subscriptionId;
    
    if (!targetSubId) {
      if (!memberId) return res.status(400).json({ message: "Member ID required for first payment." });
      
      // Initialize installments
      const installments = Array.from({ length: activeYear.totalInstallments }, (_, k) => ({
        number: k + 1,
        amountExpected: amount,
        isPaid: false
      }));

      const newSub = await Subscription.findOneAndUpdate(
        { club: clubId, year: activeYear._id, member: memberId },
        { 
           $setOnInsert: { 
             installments, 
             totalPaid: 0, 
             totalDue: activeYear.totalInstallments * amount 
           } 
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      targetSubId = newSub._id;
    }

    // 3. ATOMIC TOGGLE LOGIC
    // Attempt to SET PAID (Matches if currently false)
    let updatedSub = await Subscription.findOneAndUpdate(
      { 
        _id: targetSubId, 
        installments: { $elemMatch: { number: installmentNumber, isPaid: false } } 
      },
      {
        $set: { 
          "installments.$.isPaid": true, 
          "installments.$.paidDate": new Date(),
          "installments.$.collectedBy": userId
        },
        $inc: { totalPaid: amount, totalDue: -amount }
      },
      { new: true }
    );

    let action = "SUBSCRIPTION_PAID";

    // If update failed, it might be because it's ALREADY PAID. Try to REVOKE.
    if (!updatedSub) {
      updatedSub = await Subscription.findOneAndUpdate(
        { 
          _id: targetSubId, 
          installments: { $elemMatch: { number: installmentNumber, isPaid: true } } 
        },
        {
          $set: { 
            "installments.$.isPaid": false, 
            "installments.$.paidDate": null,
            "installments.$.collectedBy": null
          },
          $inc: { totalPaid: -amount, totalDue: amount }
        },
        { new: true }
      );
      action = "SUBSCRIPTION_REVOKED";
    }

    if (!updatedSub) {
      return res.status(404).json({ message: "Installment not found or state conflict." });
    }

    // ✅ LOG THE ACTION
    // We populate only what we need for the log
    await updatedSub.populate({ path: "member", populate: { path: "user", select: "name" }});
    const memberName = updatedSub.member?.user?.name || "Member";
    
    await logAction({
      req,
      action: action,
      target: `Sub: ${memberName} (Week #${installmentNumber})`,
      details: { amount: amount, status: action === "SUBSCRIPTION_PAID" ? "Paid" : "Unpaid" }
    });

    res.json({ success: true, data: updatedSub });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Payment Failed" });
  }
};

/**
 * @desc Get ALL Payments (Unchanged logic, just ensure safety)
 */
exports.getAllPayments = async (req, res) => {
  try {
    const { clubId } = req.user;
    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) return res.json({ success: true, data: [] });

    const subs = await Subscription.find({ club: clubId, year: activeYear._id })
      .populate({
        path: "member",
        populate: { path: "user", select: "name" }
      });

    let allPayments = [];
    subs.forEach(sub => {
      const memberName = sub.member?.user?.name || "Unknown Member";
      sub.installments.forEach(inst => {
        if (inst.isPaid) {
          allPayments.push({
            subscriptionId: sub._id,
            memberId: sub.member?._id,
            memberName: memberName,
            amount: inst.amountExpected,
            date: inst.paidDate || sub.updatedAt,
            weekNumber: inst.number,
            type: "subscription"
          });
        }
      });
    });

    allPayments.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({ success: true, data: allPayments });

  } catch (err) {
    console.error("Fetch Payments Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};