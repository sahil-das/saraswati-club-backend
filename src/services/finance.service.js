const Weekly = require("../models/WeeklyContribution");
const Puja = require("../models/PujaContribution");
const Donation = require("../models/Donation");
const Expense = require("../models/Expense");

async function sum(model, match) {
  const result = await model.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: "$amount" } } }
  ]);
  return result[0]?.total || 0;
}

exports.calculateYearSummary = async (year, openingBalance) => {
  const weekly = await sum(Weekly, { year });
  const puja = await sum(Puja, { year });
  const donations = await sum(Donation, { year });

  const expenses = await sum(Expense, {
    year,
    status: "approved",
  });

  const totalCollection = weekly + puja + donations;
  const closingBalance =
    openingBalance + totalCollection - expenses;

  return {
    openingBalance,
    weekly,
    puja,
    donations,
    totalCollection,
    expenses,
    closingBalance,
  };
};
