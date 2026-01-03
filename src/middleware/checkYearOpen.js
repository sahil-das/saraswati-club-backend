const FestivalYear = require("../models/FestivalYear"); // 👈 Changed from PujaCycle

module.exports = async (req, res, next) => {
  try {
    // 1. Check if we even know which club we are in
    if (!req.user || !req.user.clubId) {
      return res.status(400).json({ message: "Club context missing." });
    }

    // 2. Find the Active Year FOR THIS CLUB ONLY
    const activeYear = await FestivalYear.findOne({ 
      club: req.user.clubId, 
      isActive: true 
    });

    if (!activeYear) {
      return res.status(400).json({ message: "No active festival year found for this club." });
    }

    if (activeYear.isClosed) {
      return res.status(400).json({ message: "Current festival year is closed. Operations restricted." });
    }

    // 3. Attach to request for easy access in controllers
    req.year = activeYear; 
    next();

  } catch (err) {
    console.error("Year Check Error:", err);
    res.status(500).json({ message: "Server error verifying festival year" });
  }
};