// src/controllers/history.controller.js
const mongoose = require("mongoose");
const PujaCycle = require("../models/PujaCycle");
const WeeklyPayment = require("../models/WeeklyPayment");
const PujaContribution = require("../models/PujaContribution");
const Donation = require("../models/Donation");
const Expense = require("../models/Expense");
const financeService = require("../services/finance.service");

/* ================= LIST ALL CYCLES ================= */
exports.listCycles = async (req, res) => {
  try {
    const cycles = await PujaCycle.find()
      .sort({ startDate: -1 })
      .select("name startDate endDate isClosed closingBalance"); // Added closingBalance

    res.json({ success: true, data: cycles });
  } catch (err) {
    console.error("List cycles error:", err);
    res.status(500).json({ message: "Failed to load cycles" });
  }
};

/* ================= CYCLE SUMMARY (The Fix) ================= */
exports.cycleSummary = async (req, res) => {
  try {
    const { cycleId } = req.params;

    // 1. Use the Unified Service
    const stats = await financeService.calculateCycleStats(cycleId);

    // 2. Return consistent data
    res.json({
      success: true,
      data: {
        openingBalance: stats.openingBalance,
        weeklyTotal: stats.weeklyTotal,
        pujaTotal: stats.pujaTotal,
        donationTotal: stats.donationTotal,
        collections: stats.totalCollection,
        expenses: stats.expenseTotal,
        closingBalance: stats.closingBalance,
        isClosed: stats.isClosed,
      },
    });
  } catch (err) {
    console.error("Cycle summary error:", err);
    res.status(500).json({ message: "Summary failed" });
  }
};

/* ================= DETAILED LISTS (Keep existing breakdowns) ================= */
// These endpoints return lists (arrays), not just totals. 
// They must use the same filters as the service (e.g. status: 'approved').

exports.weekly = async (req, res) => {
  try {
    const { cycleId } = req.params;
    const cycle = await PujaCycle.findById(cycleId).lean();
    if (!cycle) return res.json({ success: true, data: [] });

    // Ensure we use the cycle's stored weeklyAmount
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
      {
        $group: {
          _id: "$member._id",
          memberName: { $first: "$member.name" },
          totalWeeksPaid: { $sum: 1 }, // Count weeks
          total: { $sum: weeklyAmount }, // Multiply by amount
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

exports.puja = async (req, res) => {
  try {
    const { cycleId } = req.params;
    const rows = await PujaContribution.aggregate([
      { $match: { cycle: new mongoose.Types.ObjectId(cycleId) } },
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

exports.donations = async (req, res) => {
  try {
    const { cycleId } = req.params;
    const rows = await Donation.find({ cycle: cycleId }).sort({ createdAt: 1 }).lean();
    
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

exports.expenses = async (req, res) => {
  try {
    const { cycleId } = req.params;
    // IMPORTANT: Filter by 'approved' to match the service
    const rows = await Expense.find({ cycle: cycleId, status: "approved" })
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

// closeCycle is now handled by cycle.controller.js, so we don't need it here.