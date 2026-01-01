const WeeklyPayment = require("../models/WeeklyPayment");
const Expense = require("../models/Expense");
const PujaCycle = require("../models/PujaCycle");
const Donation = require("../models/Donation");
const PujaContribution = require("../models/PujaContribution");

/* ================= DASHBOARD SUMMARY ================= */
exports.summary = async (req, res) => {
  try {
    // ✅ ONLY ACTIVE CYCLE
    const cycle = await PujaCycle.findOne({ isActive: true });

    if (!cycle) {
      return res.json({
        success: true,
        data: {
          weeklyTotal: 0,
          pujaTotal: 0,
          donationTotal: 0,
          expenseTotal: 0,
          centralBalance: 0,
        },
      });
    }

    /* ========== WEEKLY TOTAL ========== */
    const weeklyAgg = await WeeklyPayment.aggregate([
      { $match: { cycle: cycle._id } },
      { $unwind: "$weeks" },
      { $match: { "weeks.paid": true } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
        },
      },
    ]);

    const weeklyCount = weeklyAgg[0]?.count || 0;
    const weeklyTotal = weeklyCount * Number(cycle.weeklyAmount || 0);

    /* ========== PUJA TOTAL ========== */
    const pujaAgg = await PujaContribution.aggregate([
      { $match: { cycle: cycle._id } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const pujaTotal = pujaAgg[0]?.total || 0;

    /* ========== DONATION TOTAL ========== */
    const donationAgg = await Donation.aggregate([
      { $match: { cycle: cycle._id } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const donationTotal = donationAgg[0]?.total || 0;

    /* ========== EXPENSE TOTAL ========== */
    const expenseAgg = await Expense.aggregate([
      {
        $match: {
          cycle: cycle._id,
          status: "approved",
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const expenseTotal = expenseAgg[0]?.total || 0;

    /* ========== CENTRAL BALANCE ========== */
    const centralBalance =
      weeklyTotal + pujaTotal + donationTotal - expenseTotal;

    res.json({
      success: true,
      data: {
        weeklyTotal,
        pujaTotal,
        donationTotal,
        expenseTotal,
        centralBalance,
      },
    });
  } catch (err) {
    console.error("Finance summary error:", err);
    res.status(500).json({ message: "Finance summary failed" });
  }
};


/* ======================================================
   WEEKLY TOTAL (ACTIVE CYCLE ONLY)
   ====================================================== */
exports.weeklyTotal = async (req, res) => {
  try {
    const cycle = await PujaCycle.findOne({ isActive: true });
    if (!cycle) return res.json({ total: 0 });

    const weeklyAmount = Number(cycle.weeklyAmount) || 0;

    const payments = await WeeklyPayment.find({
      cycle: cycle._id,
    }).lean();

    let paidWeeks = 0;

    for (const p of payments) {
      for (const w of p.weeks) {
        if (w.paid === true) paidWeeks++;
      }
    }

    res.json({
      total: paidWeeks * weeklyAmount,
    });
  } catch (err) {
    console.error("weeklyTotal error:", err);
    res.status(500).json({ total: 0 });
  }
};

/* ======================================================
   PUJA TOTAL (ACTIVE CYCLE ONLY)
   ====================================================== */
exports.pujaTotal = async (req, res) => {
  try {
    const cycle = await PujaCycle.findOne({ isActive: true });
    if (!cycle) return res.json({ total: 0 });

    const r = await PujaContribution.aggregate([
      { $match: { cycle: cycle._id } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    res.json({ total: r[0]?.total || 0 });
  } catch (err) {
    console.error("pujaTotal error:", err);
    res.status(500).json({ total: 0 });
  }
};

/* ======================================================
   DONATION TOTAL (ACTIVE CYCLE ONLY)
   ====================================================== */
exports.donationTotal = async (req, res) => {
  try {
    const cycle = await PujaCycle.findOne({ isActive: true });
    if (!cycle) return res.json({ total: 0 });

    const r = await Donation.aggregate([
      { $match: { cycle: cycle._id } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    res.json({ total: r[0]?.total || 0 });
  } catch (err) {
    console.error("donationTotal error:", err);
    res.status(500).json({ total: 0 });
  }
};

/* ======================================================
   EXPENSE TOTAL (ACTIVE CYCLE ONLY)
   ====================================================== */
exports.expenseTotal = async (req, res) => {
  try {
    const cycle = await PujaCycle.findOne({ isActive: true });
    if (!cycle) return res.json({ total: 0 });

    const r = await Expense.aggregate([
      {
        $match: {
          status: "approved",
          cycle: cycle._id,
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    res.json({ total: r[0]?.total || 0 });
  } catch (err) {
    console.error("expenseTotal error:", err);
    res.status(500).json({ total: 0 });
  }
};

/* ======================================================
   CENTRAL FUND (OPTIONAL SINGLE API)
   ====================================================== */
exports.centralFund = async (req, res) => {
  try {
    const cycle = await PujaCycle.findOne({ isActive: true });
    if (!cycle) {
      return res.json({
        weekly: 0,
        puja: 0,
        donation: 0,
        expense: 0,
        balance: 0,
      });
    }

    const weekly = await exports.weeklyTotalInternal(cycle);
    const puja = await exports.pujaTotalInternal(cycle);
    const donation = await exports.donationTotalInternal(cycle);
    const expense = await exports.expenseTotalInternal(cycle);

    res.json({
      weekly,
      puja,
      donation,
      expense,
      balance: weekly + puja + donation - expense,
    });
  } catch (err) {
    console.error("centralFund error:", err);
    res.status(500).json({ balance: 0 });
  }
};

/* ======================================================
   INTERNAL HELPERS (USED ABOVE)
   ====================================================== */
exports.weeklyTotalInternal = async (cycle) => {
  const payments = await WeeklyPayment.find({ cycle: cycle._id }).lean();
  let paidWeeks = 0;

  for (const p of payments) {
    for (const w of p.weeks) {
      if (w.paid) paidWeeks++;
    }
  }
  return paidWeeks * Number(cycle.weeklyAmount || 0);
};

exports.pujaTotalInternal = async (cycle) => {
  const r = await PujaContribution.aggregate([
    { $match: { cycle: cycle._id } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  return r[0]?.total || 0;
};

exports.donationTotalInternal = async (cycle) => {
  const r = await Donation.aggregate([
    { $match: { cycle: cycle._id } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  return r[0]?.total || 0;
};

exports.expenseTotalInternal = async (cycle) => {
  const r = await Expense.aggregate([
    { $match: { status: "approved", cycle: cycle._id } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  return r[0]?.total || 0;
};
