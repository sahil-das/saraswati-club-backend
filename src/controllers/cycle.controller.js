const PujaCycle = require("../models/PujaCycle");

/* ================= CREATE NEW CYCLE ================= */
exports.create = async (req, res) => {
  try {
    const { name, startDate, endDate } = req.body;

    if (!name || !startDate || !endDate) {
      return res.status(400).json({
        message: "name, startDate and endDate are required",
      });
    }

    await PujaCycle.updateMany(
      { isActive: true },
      { isActive: false }
    );

    const cycle = await PujaCycle.create({
      name,
      startDate,
      endDate,
      isActive: true,
    });

    res.status(201).json({
      success: true,
      data: cycle,
    });
  } catch (err) {
    console.error("Create cycle error:", err);
    res.status(500).json({ message: "Failed to create cycle" });
  }
};

/* ================= GET ACTIVE CYCLE ================= */
exports.getActive = async (req, res) => {
  try {
    const cycle = await PujaCycle.findOne({ isActive: true });

    if (!cycle) {
      return res.status(404).json({
        message: "No active puja cycle found",
      });
    }

    res.json({
      success: true,
      data: cycle,
    });
  } catch (err) {
    console.error("Get active cycle error:", err);
    res.status(500).json({ message: "Failed to fetch active cycle" });
  }
};

/* ================= LIST ALL CYCLES (ADMIN) ================= */
exports.list = async (req, res) => {
  try {
    const cycles = await PujaCycle.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      data: cycles,
    });
  } catch (err) {
    console.error("List cycles error:", err);
    res.status(500).json({ message: "Failed to list cycles" });
  }
};

/* ================= GET AVAILABLE YEARS (FOR HISTORY) ================= */
exports.getYears = async (req, res) => {
  try {
    const cycles = await PujaCycle.find().select("startDate endDate");

    const yearsSet = new Set();

    cycles.forEach((cycle) => {
      if (cycle.startDate) {
        yearsSet.add(new Date(cycle.startDate).getFullYear());
      }
      if (cycle.endDate) {
        yearsSet.add(new Date(cycle.endDate).getFullYear());
      }
    });

    const years = Array.from(yearsSet).sort((a, b) => b - a);

    res.json({
      success: true,
      data: years,
    });
  } catch (err) {
    console.error("Get cycle years error:", err);
    res.status(500).json({ message: "Failed to load years" });
  }
};
exports.closeCycle = async (req, res) => {
  try {
    const cycle = await PujaCycle.findById(req.params.id);

    if (!cycle) {
      return res.status(404).json({ message: "Cycle not found" });
    }

    if (cycle.isClosed) {
      return res.status(400).json({ message: "Cycle already closed" });
    }

    cycle.isActive = false;
    cycle.isClosed = true;

    await cycle.save();

    res.json({
      success: true,
      message: "Year closed successfully",
      data: cycle,
    });
  } catch (err) {
    console.error("Close cycle error", err);
    res.status(500).json({ message: "Failed to close cycle" });
  }
};
