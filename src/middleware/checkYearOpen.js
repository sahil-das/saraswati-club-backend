// src/middleware/checkYearOpen.js
const PujaCycle = require("../models/PujaCycle");

module.exports = async (req, res, next) => {
  try {
    // 1. Fetch the currently active cycle
    const activeCycle = await PujaCycle.findOne({ isActive: true });

    // 2. Strict Check: Must exist
    if (!activeCycle) {
      return res.status(403).json({
        success: false,
        message: "Action Denied: No active financial year found. Please contact admin to start a new cycle.",
      });
    }

    // 3. Strict Check: Must not be closed
    if (activeCycle.isClosed) {
      return res.status(403).json({
        success: false,
        message: "Action Denied: The current financial year is CLOSED. No further entries allowed.",
      });
    }

    // 4. Attach cycle to request for easy access in controllers
    // This ensures all downstream controllers use the EXACT active cycle ID
    req.activeCycle = activeCycle;
    
    next();
  } catch (err) {
    console.error("Middleware checkYearOpen Error:", err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};