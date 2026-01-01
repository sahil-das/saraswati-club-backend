const WeeklyPayment = require("../models/WeeklyPayment");
const Expense = require("../models/Expense");
const PujaCycle = require("../models/PujaCycle");
const Donation = require("../models/Donation");
const PujaContribution = require("../models/PujaContribution");

/* ================= WEEKLY TOTAL ================= */
exports.weeklyTotal = async (req, res) => {
  try {
    const cycle = await PujaCycle.findOne({ isActive: true });
    if (!cycle) return res.json({ total: 0 });

    const weeklyAmount = Number(cycle.weeklyAmount) || 0;

    const payments = await WeeklyPayment.find({ cycle: cycle._id });

    let paidWeeks = 0;
    payments.forEach(p =>
      p.weeks.forEach(w => w.paid && paidWeeks++)
    );

    res.json({ total: paidWeeks * weeklyAmount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ total: 0 });
  }
};

/* ================= PUJA TOTAL ================= */
exports.pujaTotal = async (req, res) => {
  const cycle = await PujaCycle.findOne({ isActive: true });
  if (!cycle) return res.json({ total: 0 });

  const r = await PujaContribution.aggregate([
    { $match: { cycle: cycle._id} },
    { $group: { _id: null, total: { $sum: "$amount" } } }
  ]);

  res.json({ total: r[0]?.total || 0 });
};

/* ================= DONATION TOTAL ================= */
exports.donationTotal = async (req, res) => {
  const cycle = await PujaCycle.findOne({ isActive: true });
  if (!cycle) return res.json({ total: 0 });

  const r = await Donation.aggregate([
    { $match: { cycle: cycle._id} },
    { $group: { _id: null, total: { $sum: "$amount" } } }
  ]);

  res.json({ total: r[0]?.total || 0 });
};

/* ================= EXPENSE TOTAL ================= */
exports.expenseTotal = async (req, res) => {
  const cycle = await PujaCycle.findOne({ isActive: true });
  if (!cycle) return res.json({ total: 0 });

  const r = await Expense.aggregate([
    {
      $match: {
        status: "approved",
        cycle: cycle._id
      }
    },
    { $group: { _id: null, total: { $sum: "$amount" } } }
  ]);

  res.json({ total: r[0]?.total || 0 });
};
