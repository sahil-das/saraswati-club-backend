const Subscription = require("../models/Subscription");
const FestivalYear = require("../models/FestivalYear");
const Membership = require("../models/Membership");
const { logAction } = require("../utils/auditLogger");

/**
 * @desc Get Subscription Card & Self-Heal Data
 */
exports.getMemberSubscription = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { clubId } = req.user;

    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) return res.status(400).json({ message: "No active year found." });

    const memberShip = await Membership.findById(memberId).populate("user");
    if (!memberShip) return res.status(404).json({ message: "Member not found" });

    const memberName = memberShip.user ? memberShip.user.name : "Unknown Member";
    const memberUserId = memberShip.user ? memberShip.user._id : null; 

    let sub = await Subscription.findOne({ 
      club: clubId, 
      year: activeYear._id, 
      member: memberId 
    });

    // ✅ FIX: Ensure Target Amount is a Number (Mongoose getter returns String "50.00")
    const targetAmount = Number(activeYear.amountPerInstallment) || 0;
    const targetCount = activeYear.totalInstallments || 52;

    if (!sub) {
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
      const needsUpdate = sub.installments.some(i => Number(i.amountExpected) !== targetAmount);
      
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
 * @desc Pay Installment
 */
exports.payInstallment = async (req, res) => {
  try {
    const { subscriptionId, installmentNumber } = req.body;
    
    const sub = await Subscription.findById(subscriptionId).populate("year");
    if (!sub) return res.status(404).json({ message: "Subscription not found" });

    if (sub.year.subscriptionFrequency === 'none') {
       return res.status(400).json({ message: "Subscriptions are disabled for this year." });
    }

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

    // ✅ FIX: Recalculate Totals using Number() to prevent string concatenation
    let newPaid = 0;
    let newDue = 0;
    
    sub.installments.forEach(i => {
        // Mongoose getter returns string "50.00", so we MUST wrap in Number()
        const amt = Number(i.amountExpected);
        if(i.isPaid) newPaid += amt;
        else newDue += amt;
    });

    sub.totalPaid = newPaid;
    sub.totalDue = newDue;

    await sub.save();

    const memberName = sub.member?.user?.name || "Member";
    await logAction({
      req,
      action: newStatus ? "SUBSCRIPTION_PAID" : "SUBSCRIPTION_REVOKED",
      target: `Sub: ${memberName} (Week #${installmentNumber})`,
      details: { amount: Number(installment.amountExpected), status: newStatus ? "Paid" : "Unpaid" }
    });

    res.json({ success: true, data: sub });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Payment Failed" });
  }
};

/**
 * @desc Get ALL Payments
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
            // ✅ FIX: Force Number conversion
            amount: Number(inst.amountExpected),
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
    res.status(500).json({ message: "Server Error" });
  }
}; 