const FinancialYear = require("../models/FinancialYear");
const { calculateYearSummary } = require("../services/finance.service");

exports.closeYear = async (req, res) => {
  const { year } = req.body;

  const fy = await FinancialYear.findOne({ year });
  if (!fy) return res.status(404).json({ message: "Year not found" });
  if (fy.isClosed)
    return res.status(400).json({ message: "Already closed" });

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
};
