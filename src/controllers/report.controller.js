const FinancialYear = require("../models/FinancialYear");
const { calculateYearSummary } = require("../services/finance.service");

exports.getSummary = async (req, res) => {
  try {
    const year = Number(req.query.year);

    if (!year) {
      return res.status(400).json({
        message: "Year is required",
      });
    }

    const fy = await FinancialYear.findOne({ year });
    if (!fy) {
      return res.status(404).json({
        message: "Financial year not found",
      });
    }

    const summary = await calculateYearSummary(
      year,
      fy.openingBalance
    );

    res.json({
      success: true,
      summary,
    });
  } catch (err) {
    console.error("report summary error:", err);
    res.status(500).json({
      message: "Failed to load summary",
    });
  }
};
