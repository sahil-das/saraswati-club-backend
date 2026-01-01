// src/controllers/cycle.controller.js
const PujaCycle = require("../models/PujaCycle");
const financeService = require("../services/finance.service");

/* ================= CREATE NEW CYCLE ================= */
exports.create = async (req, res) => {
  try {
    const { name, startDate, endDate, weeklyAmount, totalWeeks, openingBalance } = req.body;

    if (!name || !startDate || !endDate) {
      return res.status(400).json({
        message: "Name, Start Date, and End Date are required",
      });
    }

    // 1. Ensure no other cycle is active
    await PujaCycle.updateMany({ isActive: true }, { isActive: false });

    // 2. Auto-detect Opening Balance if not provided
    // Logic: Look for the most recently closed cycle and take its closingBalance
    let finalOpeningBalance = openingBalance;
    
    if (finalOpeningBalance === undefined || finalOpeningBalance === null) {
      const lastClosedCycle = await PujaCycle.findOne({ isClosed: true })
        .sort({ endDate: -1 }); // Get latest finished cycle
      
      finalOpeningBalance = lastClosedCycle ? (lastClosedCycle.closingBalance || 0) : 0;
    }

    // 3. Create the new cycle
    const cycle = await PujaCycle.create({
      name,
      startDate,
      endDate,
      weeklyAmount: Number(weeklyAmount) || 0, // Store standard rate for this year
      totalWeeks: Number(totalWeeks) || 52,
      openingBalance: Number(finalOpeningBalance),
      isActive: true, // Auto-activate new cycle
      isClosed: false,
    });

    res.status(201).json({
      success: true,
      data: cycle,
      message: `New Cycle '${cycle.name}' created with Opening Balance: ₹${cycle.openingBalance}`,
    });

  } catch (err) {
    console.error("Create cycle error:", err);
    res.status(500).json({ message: "Failed to create cycle" });
  }
};

/* ================= CLOSE ACTIVE CYCLE (End of Year) ================= */
exports.closeActiveCycle = async (req, res) => {
  try {
    // 1. Find the active cycle
    const cycle = await PujaCycle.findOne({ isActive: true });

    if (!cycle) {
      return res.status(404).json({ message: "No active cycle found to close." });
    }

    if (cycle.isClosed) {
      return res.status(400).json({ message: "Cycle is already closed." });
    }

    // 2. Calculate FINAL Accounting Stats
    // We use the service to ensure the numbers match exactly what is on the dashboard
    const stats = await financeService.calculateCycleStats(cycle._id);

    // 3. Freeze the Cycle
    cycle.closingBalance = stats.closingBalance; // Hardcode the final result
    cycle.isClosed = true;
    cycle.isActive = false; // No cycle is active until a new one is created
    cycle.closedAt = new Date();

    await cycle.save();

    res.json({
      success: true,
      data: {
        cycleId: cycle._id,
        name: cycle.name,
        finalClosingBalance: cycle.closingBalance,
        totalCollection: stats.totalCollection,
        totalExpenses: stats.expenseTotal
      },
      message: `Year '${cycle.name}' Closed Successfully. Final Balance: ₹${cycle.closingBalance}`
    });

  } catch (err) {
    console.error("Close cycle error:", err);
    res.status(500).json({ message: "Failed to close cycle. Data integrity check failed." });
  }
};

/* ================= GET ACTIVE CYCLE ================= */
exports.getActive = async (req, res) => {
  try {
    const cycle = await PujaCycle.findOne({ isActive: true });
    if (!cycle) {
      return res.status(404).json({ message: "No active puja cycle found" });
    }
    res.json({ success: true, data: cycle });
  } catch (err) {
    console.error("Get active cycle error:", err);
    res.status(500).json({ message: "Failed to fetch active cycle" });
  }
};

/* ================= LIST ALL CYCLES (ADMIN) ================= */
exports.list = async (req, res) => {
  try {
    const cycles = await PujaCycle.find().sort({ startDate: -1 });
    res.json({ success: true, data: cycles });
  } catch (err) {
    console.error("List cycles error:", err);
    res.status(500).json({ message: "Failed to list cycles" });
  }
};