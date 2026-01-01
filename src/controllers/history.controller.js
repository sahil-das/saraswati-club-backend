const WeeklyPayment = require("../models/WeeklyPayment");
const PujaContribution = require("../models/PujaContribution");
const Donation = require("../models/Donation");
const Expense = require("../models/Expense");
const PujaCycle = require("../models/PujaCycle");
const mongoose = require("mongoose");

/* =====================================================
   LIST ALL CYCLES (FOR HISTORY PAGE)
   ===================================================== */
exports.listCycles = async (req, res) => {
  try {
    const cycles = await PujaCycle.find()
      .sort({ startDate: -1 })
      .select("name startDate endDate isClosed");

    res.json({ success: true, data: cycles });
  } catch (err) {
    console.error("List cycles error:", err);
    res.status(500).json({ message: "Failed to load cycles" });
  }
};

/* =====================================================
   SUMMARY (SINGLE CYCLE)
   ===================================================== */
exports.cycleSummary = async (req, res) => {
  try {
    const { cycleId } = req.params;
    const cycle = await PujaCycle.findById(cycleId);

    if (!cycle) {
      return res.status(404).json({ message: "Cycle not found" });
    }

    /* ===== WEEKLY ===== */
    const weekly = await WeeklyPayment.aggregate([
      { $match: { cycle: cycle._id } },
      { $unwind: "$weeks" },
      { $match: { "weeks.paid": true } },
      {
        $group: {
          _id: null,
          total: { $sum: cycle.weeklyAmount },
        },
      },
    ]);

    /* ===== PUJA ===== */
    const puja = await PujaContribution.aggregate([
      { $match: { cycle: cycle._id } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    /* ===== DONATIONS ===== */
    const donations = await Donation.aggregate([
      { $match: { cycle: cycle._id } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    /* ===== EXPENSES ===== */
    const expensesAgg = await Expense.aggregate([
      {
        $match: {
          cycle: cycle._id,
          status: "approved",
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const collections =
      (weekly[0]?.total || 0) +
      (puja[0]?.total || 0) +
      (donations[0]?.total || 0);

    const expenses = expensesAgg[0]?.total || 0;

    res.json({
      success: true,
      data: {
        openingBalance: cycle.openingBalance || 0,
        weeklyTotal: weekly[0]?.total || 0,
        pujaTotal: puja[0]?.total || 0,
        donationTotal: donations[0]?.total || 0,
        collections,
        expenses,
        closingBalance:
          (cycle.openingBalance || 0) + collections - expenses,
        isClosed: cycle.isClosed,
      },
    });
  } catch (err) {
    console.error("Cycle summary error:", err);
    res.status(500).json({ message: "Summary failed" });
  }
};

/* =====================================================
   WEEKLY – PER MEMBER TOTAL
   ===================================================== */
exports.weekly = async (req, res) => {
  try {
    const { cycleId } = req.params;

    const cycle = await PujaCycle.findById(cycleId).lean();
    if (!cycle) return res.json({ success: true, data: [] });

    const weeklyAmount = Number(cycle.weeklyAmount) || 0;

    const rows = await WeeklyPayment.aggregate([
      { $match: { cycle: cycle._id } },
      { $unwind: "$weeks" },
      { $match: { "weeks.paid": true } },

      {
        $lookup: {
          from: "users",
          localField: "member",
          foreignField: "_id",
          as: "member",
        },
      },
      { $unwind: "$member" },

      // ✅ inject weeklyAmount safely
      {
        $addFields: {
          amount: weeklyAmount,
        },
      },

      {
        $group: {
          _id: "$member._id",
          memberName: { $first: "$member.name" },
          total: { $sum: "$amount" },
        },
      },

      { $sort: { memberName: 1 } },
    ]);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("History weekly error:", err);
    res.status(500).json({ message: "Weekly history failed" });
  }
};


/* =====================================================
   PUJA – PER MEMBER TOTAL
   ===================================================== */
exports.puja = async (req, res) => {
  try {
    const { cycleId } = req.params;

    const rows = await PujaContribution.aggregate([
      {
        $match: {
          cycle: new mongoose.Types.ObjectId(cycleId),
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "member",
          foreignField: "_id",
          as: "member",
        },
      },
      { $unwind: "$member" },
      {
        $group: {
          _id: "$member._id",
          memberName: { $first: "$member.name" },
          total: { $sum: "$amount" },
        },
      },
      { $sort: { memberName: 1 } },
    ]);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("History puja error:", err);
    res.status(500).json({ message: "Puja history failed" });
  }
};


/* =====================================================
   DONATIONS – LIST
   ===================================================== */
exports.donations = async (req, res) => {
  try {
    const { cycleId } = req.params;

    const rows = await Donation.find({ cycle: cycleId })
      .sort({ createdAt: 1 })
      .lean();

    res.json({
      success: true,
      data: rows.map((d) => ({
        donorName: d.donorName,
        amount: d.amount,
        date: d.createdAt.toISOString().slice(0, 10),
      })),
    });
  } catch (err) {
    console.error("Donation history error:", err);
    res.status(500).json({ message: "Donation history failed" });
  }
};

/* =====================================================
   EXPENSES – LIST
   ===================================================== */
exports.expenses = async (req, res) => {
  try {
    const { cycleId } = req.params;

    const rows = await Expense.find({
      cycle: cycleId,
      status: "approved",
    })
      .sort({ createdAt: 1 })
      .lean();

    res.json({
      success: true,
      data: rows.map((e) => ({
        title: e.title,
        amount: e.amount,
        date: e.createdAt.toISOString().slice(0, 10),
      })),
    });
  } catch (err) {
    console.error("Expense history error:", err);
    res.status(500).json({ message: "Expense history failed" });
  }
};

/* =====================================================
   CLOSE CYCLE (ADMIN)
   ===================================================== */
exports.closeCycle = async (req, res) => {
  try {
    const { cycleId } = req.params;

    const cycle = await PujaCycle.findById(cycleId);
    if (!cycle) {
      return res.status(404).json({ message: "Cycle not found" });
    }

    if (cycle.isClosed) {
      return res.status(400).json({ message: "Cycle already closed" });
    }

    cycle.isClosed = true;
    cycle.closedAt = new Date();
    await cycle.save();

    res.json({ success: true });
  } catch (err) {
    console.error("Close cycle error:", err);
    res.status(500).json({ message: "Close cycle failed" });
  }
};
