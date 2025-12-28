const FinancialYear = require("../models/FinancialYear");
const { calculateYearSummary } = require("../services/finance.service");

// GET ALL YEARS (HISTORY LIST)
exports.getYears = async (req, res) => {
  try {
    const years = await FinancialYear.find()
      .sort({ year: -1 })
      .lean();

    res.json({
      success: true,
      data: years,
    });
  } catch (err) {
    console.error("getYears error:", err);
    res.status(500).json({
      message: "Failed to fetch years",
    });
  }
};

// CLOSE FINANCIAL YEAR
exports.closeYear = async (req, res) => {
  try {
    const { year } = req.body;

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

    if (fy.isClosed) {
      return res.status(400).json({
        message: "Year already closed",
      });
    }

    const summary = await calculateYearSummary(
      year,
      fy.openingBalance
    );

    fy.isClosed = true;
    fy.closedAt = new Date();
    await fy.save();

    const nextYear = year + 1;
    const exists = await FinancialYear.findOne({ year: nextYear });

    if (!exists) {
      await FinancialYear.create({
        year: nextYear,
        openingBalance: summary.closingBalance,
      });
    }

    res.json({
      success: true,
      message: `Year ${year} closed`,
      summary,
    });
  } catch (err) {
    console.error("closeYear error:", err);
    res.status(500).json({
      message: "Failed to close year",
    });
  }
};
