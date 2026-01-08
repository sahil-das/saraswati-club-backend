const FestivalYear = require("../models/FestivalYear");
const yearController = require("./festivalYear.controller"); // 👈 Import the Year Logic

/**
 * @desc Get Settings (Proxies to getActiveYear)
 * @route GET /api/v1/settings
 */
exports.get = async (req, res) => {
  // The 'getActiveYear' controller already looks for { club: req.user.clubId, isActive: true }
  // So we can directly delegate the request.
  return yearController.getActiveYear(req, res);
};

/**
 * @desc Update Settings (Finds Active Year -> Proxies to updateYear)
 * @route PUT /api/v1/settings
 */
exports.update = async (req, res) => {
  try {
    const { clubId } = req.user;

    // 1. Find the ID of the currently active year
    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    
    if (!activeYear) {
      return res.status(404).json({ message: "No active festival year found to update." });
    }

    // 2. Inject the ID into req.params so the Year Controller can use it
    req.params.id = activeYear._id.toString();

    // 3. Delegate to the robust logic in FestivalYear Controller
    // This ensures all safety checks (like "Cannot change frequency if payments exist") are applied.
    return yearController.updateYear(req, res);

  } catch (err) {
    console.error("Settings Proxy Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @desc Close Year (Proxies to closeYear)
 * @route POST /api/v1/settings/close-year
 */
exports.closeYear = async (req, res) => {
  try {
    const { clubId } = req.user;

    // 1. Find Active Year
    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    
    if (!activeYear) {
      return res.status(404).json({ message: "No active festival year found to close." });
    }

    // 2. Inject ID and Delegate
    req.params.id = activeYear._id.toString();
    return yearController.closeYear(req, res);

  } catch (err) {
    console.error("Settings Proxy Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};