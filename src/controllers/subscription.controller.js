const Subscription = require("../models/Subscription");
const FestivalYear = require("../models/FestivalYear");
const User = require("../models/User");
const { generateInstallments } = require("../utils/subscriptionGenerator");

/**
 * HELPER: Ensure a subscription card exists for a user in a specific year
 */
const ensureSubscriptionExists = async (clubId, yearId, userId) => {
  let sub = await Subscription.findOne({ club: clubId, year: yearId, user: userId });

  if (!sub) {
    // 1. Fetch Year Rules (to know if it's 52 weeks or 12 months)
    const year = await FestivalYear.findById(yearId);
    if (!year) throw new Error("Invalid Festival Year");

    // 2. Generate Empty Slots
    const installments = generateInstallments(
      year.subscriptionFrequency, 
      year.totalInstallments, 
      year.amountPerInstallment
    );

    // 3. Create Card
    sub = await Subscription.create({
      club: clubId,
      year: yearId,
      user: userId,
      installments: installments,
      totalPaid: 0,
      totalDue: installments.reduce((acc, curr) => acc + curr.amountExpected, 0)
    });
  }
  return sub;
};

/**
 * @route GET /api/v1/subscriptions
 * @desc Get ALL subscriptions for the Active Year (Admin View)
 */
exports.getAllSubscriptions = async (req, res) => {
  try {
    const { clubId } = req.user;
    
    // 1. Find the Active Year for this club
    // (We link data to the CYCLE, not dates)
    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) {
      return res.status(404).json({ message: "No active festival year found." });
    }

    // 2. Fetch all members of the club
    // (We need to make sure every member has a card)
    // Note: You'll need to import Membership to find club members
    const Membership = require("../models/Membership"); 
    const memberships = await Membership.find({ club: clubId, status: "active" }).populate("user", "name email phone");

    // 3. Prepare data (Lazy Load Subscriptions)
    const results = [];
    for (const m of memberships) {
      const sub = await ensureSubscriptionExists(clubId, activeYear._id, m.user._id);
      results.push({
        user: m.user,
        subscription: sub
      });
    }

    res.json({ success: true, year: activeYear.name, data: results });

  } catch (err) {
    console.error("Get Subscriptions Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @route GET /api/v1/subscriptions/me
 * @desc Get MY subscription for the Active Year
 */
exports.getMySubscription = async (req, res) => {
  try {
    const { clubId, id: userId } = req.user;

    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) return res.status(404).json({ message: "No active year." });

    const sub = await ensureSubscriptionExists(clubId, activeYear._id, userId);

    res.json({ success: true, data: sub });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @route PUT /api/v1/subscriptions/:subscriptionId/installments
 * @desc Mark a specific week/month as PAID or UNPAID
 */
exports.updateInstallmentStatus = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { index, isPaid } = req.body; // index: 1 (Week 1), isPaid: true/false
    const { id: adminId } = req.user;

    // 1. Find Subscription
    const sub = await Subscription.findOne({ _id: subscriptionId, club: req.user.clubId });
    if (!sub) return res.status(404).json({ message: "Subscription not found" });

    // 2. Find the specific slot (e.g., Week 5)
    const slot = sub.installments.find(i => i.index === index);
    if (!slot) return res.status(400).json({ message: "Invalid installment index" });

    // 3. Update State
    slot.isPaid = isPaid;
    slot.paidAt = isPaid ? new Date() : null;
    slot.collectedBy = isPaid ? adminId : null;

    // 4. Recalculate Totals
    sub.totalPaid = sub.installments.filter(i => i.isPaid).reduce((sum, i) => sum + i.amountExpected, 0);
    
    await sub.save();

    res.json({ success: true, message: "Updated successfully", subscription: sub });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Update failed" });
  }
};