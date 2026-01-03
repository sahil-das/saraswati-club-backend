const FestivalYear = require("../models/FestivalYear");
const Club = require("../models/Club");

/**
 * @route POST /api/v1/years
 * @desc Create a new financial year (e.g. "2025-2026")
 */
exports.createYear = async (req, res) => {
  try {
    const { name, startDate, endDate, openingBalance } = req.body;
    const { clubId, id: userId } = req.user; // from Auth Middleware

    // 1. Fetch Club Settings (To freeze the rules)
    const club = await Club.findById(clubId);
    if (!club) return res.status(404).json({ message: "Club not found" });

    // 2. Deactivate any currently active year
    // (We auto-switch to the new one)
    await FestivalYear.updateMany(
      { club: clubId, isActive: true },
      { $set: { isActive: false } }
    );

    // 3. Create the Year with SNAPSHOT of settings
    const newYear = await FestivalYear.create({
      club: clubId,
      name,
      startDate,
      endDate,
      openingBalance: openingBalance || 0,
      
      // Copying settings from Club to Year
      subscriptionFrequency: club.settings.contributionFrequency,
      totalInstallments: club.settings.defaultInstallmentCount,
      amountPerInstallment: club.settings.defaultAmountPerInstallment,
      
      isActive: true, // Auto-active
      createdBy: userId
    });

    res.status(201).json({
      success: true,
      message: `Cycle '${name}' created and set as active.`,
      year: newYear
    });

  } catch (err) {
    console.error("Create Year Error:", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @route GET /api/v1/years
 * @desc Get all years for this club
 */
exports.getAllYears = async (req, res) => {
  try {
    const years = await FestivalYear.find({ club: req.user.clubId })
      .sort({ startDate: -1 }); // Newest first

    res.json({ success: true, data: years });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @route GET /api/v1/years/active
 * @desc Get the currently active year (Context for Dashboard)
 */
exports.getActiveYear = async (req, res) => {
  try {
    const activeYear = await FestivalYear.findOne({ 
      club: req.user.clubId, 
      isActive: true 
    });

    if (!activeYear) {
      return res.status(404).json({ message: "No active year found. Please create one." });
    }

    res.json({ success: true, data: activeYear });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};