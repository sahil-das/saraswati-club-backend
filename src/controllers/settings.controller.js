// src/controllers/settings.controller.js
const PujaCycle = require("../models/PujaCycle");
const cycleController = require("./cycle.controller"); // Import the fixed controller

/* ================= GET SETTINGS ================= */
exports.get = async (req, res) => {
  try {
    const cycle = await PujaCycle.findOne({ isActive: true });
    res.json({
      success: true,
      data: cycle || null,
    });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
};

/* ================= UPDATE SETTINGS ================= */
exports.update = async (req, res) => {
  try {
    const cycle = await PujaCycle.findOne({ isActive: true });
    if (!cycle) return res.status(404).json({ message: "No active cycle" });

    // STRICT CHECK: Cannot edit settings if year is closed
    if (cycle.isClosed) {
      return res.status(403).json({ message: "Cycle is closed. Cannot edit settings." });
    }

    const { name, startDate, endDate, totalWeeks, weeklyAmount } = req.body;

    // Update fields
    if (name) cycle.name = name;
    if (startDate) cycle.startDate = startDate;
    if (endDate) cycle.endDate = endDate;
    if (totalWeeks) cycle.totalWeeks = Number(totalWeeks);
    if (weeklyAmount) cycle.weeklyAmount = Number(weeklyAmount);

    await cycle.save();

    res.json({ success: true, message: "Settings updated successfully" });
  } catch (err) {
    console.error("Settings update error:", err);
    res.status(500).json({ message: "Failed to update settings" });
  }
};

/* ================= CLOSE YEAR (Wrapper) ================= */
// If the frontend calls /api/settings/close-year, we delegate to cycleController
exports.closeYear = async (req, res) => {
  return cycleController.closeActiveCycle(req, res);
};