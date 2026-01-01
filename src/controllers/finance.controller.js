// src/controllers/finance.controller.js
const PujaCycle = require("../models/PujaCycle");
const financeService = require("../services/finance.service");

/* ================= DASHBOARD SUMMARY ================= */
exports.summary = async (req, res) => {
  try {
    // 1. Get Active Cycle
    // Note: 'req.activeCycle' is available if you use the checkYearOpen middleware, 
    // but for the dashboard (read-only), we might not enforce that middleware everywhere.
    // So we fetch safely here.
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

    // 2. Use the Service for Consistency
    const stats = await financeService.calculateCycleStats(cycle._id);

    // 3. Send Response
    res.json({
      success: true,
      data: {
        weeklyTotal: stats.weeklyTotal,
        pujaTotal: stats.pujaTotal,
        donationTotal: stats.donationTotal,
        expenseTotal: stats.expenseTotal,
        centralBalance: stats.closingBalance, // Matches "Closing Balance" logic
      },
    });
  } catch (err) {
    console.error("Finance summary error:", err);
    res.status(500).json({ message: "Finance summary failed" });
  }
};

/* ================= INDIVIDUAL TOTALS (Used by specific widgets) ================= */
// We reuse the service to ensure these widgets match the main summary

exports.weeklyTotal = async (req, res) => {
  try {
    const cycle = await PujaCycle.findOne({ isActive: true });
    if (!cycle) return res.json({ total: 0 });
    const stats = await financeService.calculateCycleStats(cycle._id);
    res.json({ total: stats.weeklyTotal });
  } catch (err) { res.status(500).json({ total: 0 }); }
};

exports.pujaTotal = async (req, res) => {
  try {
    const cycle = await PujaCycle.findOne({ isActive: true });
    if (!cycle) return res.json({ total: 0 });
    const stats = await financeService.calculateCycleStats(cycle._id);
    res.json({ total: stats.pujaTotal });
  } catch (err) { res.status(500).json({ total: 0 }); }
};

exports.donationTotal = async (req, res) => {
  try {
    const cycle = await PujaCycle.findOne({ isActive: true });
    if (!cycle) return res.json({ total: 0 });
    const stats = await financeService.calculateCycleStats(cycle._id);
    res.json({ total: stats.donationTotal });
  } catch (err) { res.status(500).json({ total: 0 }); }
};

exports.expenseTotal = async (req, res) => {
  try {
    const cycle = await PujaCycle.findOne({ isActive: true });
    if (!cycle) return res.json({ total: 0 });
    const stats = await financeService.calculateCycleStats(cycle._id);
    res.json({ total: stats.expenseTotal });
  } catch (err) { res.status(500).json({ total: 0 }); }
};