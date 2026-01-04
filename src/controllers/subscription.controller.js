const Subscription = require("../models/Subscription");
const FestivalYear = require("../models/FestivalYear");
const Membership = require("../models/Membership");
const User = require("../models/User");
const { logAction } = require("../utils/auditLogger");
/**
 * @desc Get Subscription Card & Self-Heal Data
 */
exports.getMemberSubscription = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { clubId } = req.user;

    // 1. Get Active Year
    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) return res.status(400).json({ message: "No active year found. Please start a year in Dashboard." });

    // 2. Fetch Membership & User Details
    const memberShip = await Membership.findById(memberId).populate("user");
    if (!memberShip) return res.status(404).json({ message: "Member not found" });

    // ✅ FIX: Capture User ID and Name safely
    const memberName = memberShip.user ? memberShip.user.name : "Unknown Member";
    const memberUserId = memberShip.user ? memberShip.user._id : null; 

    // 3. Find Subscription
    let sub = await Subscription.findOne({ 
      club: clubId, 
      year: activeYear._id, 
      member: memberId 
    });

    // 4. AUTO-CREATE or AUTO-FIX (Self-Healing Logic 🪄)
    const targetAmount = activeYear.amountPerInstallment || 0;
    const targetCount = activeYear.totalInstallments || 52;

    if (!sub) {
      // Create New
      const installments = [];
      for (let i = 1; i <= targetCount; i++) {
        installments.push({
          number: i,
          amountExpected: targetAmount,
          isPaid: false
        });
      }

      sub = await Subscription.create({
        club: clubId,
        year: activeYear._id,
        member: memberId,
        installments: installments,
        totalDue: targetCount * targetAmount
      });
    } else {
      // 5. DATA REPAIR
      const needsUpdate = sub.installments.some(i => i.amountExpected !== targetAmount);
      
      if (needsUpdate && targetAmount > 0) {
        sub.installments.forEach(i => { i.amountExpected = targetAmount; });
        
        const paidCount = sub.installments.filter(i => i.isPaid).length;
        sub.totalPaid = paidCount * targetAmount;
        sub.totalDue = (sub.installments.length * targetAmount) - sub.totalPaid;
        
        await sub.save();
      }
    }

    res.json({
      success: true,
      data: {
        subscription: sub,
        memberName: memberName,
        memberUserId: memberUserId, // 👈 CRITICAL FIX: Sending User ID to Frontend
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
 * @desc Pay Installment
 */
exports.payInstallment = async (req, res) => {
  try {
    const { subscriptionId, installmentNumber } = req.body;
    
    const sub = await Subscription.findById(subscriptionId).populate("year");
    if (!sub) return res.status(404).json({ message: "Subscription not found" });

    // 🔒 SECURITY CHECK: If Year Frequency is 'none', block payment
    if (sub.year.subscriptionFrequency === 'none') {
       return res.status(400).json({ 
         message: "This financial year is set to 'Donations Only'. Subscriptions are disabled." 
       });
    }

    // 🔒 SECURITY CHECK
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only Admins can update payments." });
    }

    const installment = sub.installments.find(i => i.number === installmentNumber);
    if (!installment) return res.status(404).json({ message: "Invalid Installment" });

    // Toggle Status
    const newStatus = !installment.isPaid;
    installment.isPaid = newStatus;
    installment.paidDate = newStatus ? new Date() : null;
    installment.collectedBy = newStatus ? req.user.id : null;

    // Recalculate Totals
    let newPaid = 0;
    let newDue = 0;
    
    sub.installments.forEach(i => {
        if(i.isPaid) newPaid += i.amountExpected;
        else newDue += i.amountExpected;
    });

    sub.totalPaid = newPaid;
    sub.totalDue = newDue;

    await sub.save();

    // ✅ LOG THE ACTION
    const memberName = sub.member?.user?.name || "Member";
    await logAction({
      req,
      action: newStatus ? "SUBSCRIPTION_PAID" : "SUBSCRIPTION_REVOKED",
      target: `Sub: ${memberName} (Week #${installmentNumber})`,
      details: { amount: installment.amountExpected, status: newStatus ? "Paid" : "Unpaid" }
    });

    res.json({ success: true, data: sub });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Payment Failed" });
  }
};


/**
 * @desc Get ALL Payments for the Active Year (For Reports)
 * @route GET /api/v1/subscriptions/payments
 */
exports.getAllPayments = async (req, res) => {
  try {
    const { clubId } = req.user;

    // 1. Get Active Year
    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) return res.json({ success: true, data: [] });

    // 2. Fetch all subscriptions for this year
    const subs = await Subscription.find({ club: clubId, year: activeYear._id })
      .populate({
        path: "member",
        populate: { path: "user", select: "name" }
      });

    // 3. Extract PAID installments into a flat list
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
            date: inst.paidDate || sub.updatedAt, // Fallback date
            weekNumber: inst.number,
            type: "subscription"
          });
        }
      });
    });

    // Sort by Date (Most recent first)
    allPayments.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ success: true, data: allPayments });

  } catch (err) {
    console.error("Fetch Payments Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};