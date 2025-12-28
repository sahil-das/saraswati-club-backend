const FinancialYear = require("../models/FinancialYear");

const checkYearOpen = async (req, res, next) => {
  try {
    const year = req.body.year || req.query.year;

    if (!year) {
      return res.status(400).json({
        success: false,
        message: "Year is required",
      });
    }

    const fy = await FinancialYear.findOne({ year });

    if (!fy) {
      return res.status(404).json({
        success: false,
        message: "Financial year not found",
      });
    }

    if (fy.isClosed) {
      return res.status(403).json({
        success: false,
        message: "Financial year is closed. No changes allowed.",
      });
    }

    req.financialYear = fy;
    next();
  } catch (err) {
    console.error("checkYearOpen error:", err);
    res.status(500).json({
      success: false,
      message: "Year validation failed",
    });
  }
};

module.exports = checkYearOpen;
