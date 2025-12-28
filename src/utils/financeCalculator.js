import WeeklyContribution from "../models/WeeklyContribution.js";
import PujaContribution from "../models/PujaContribution.js";
import Donation from "../models/Donation.js";
import Expense from "../models/Expense.js";

export const calculateYearFinance = async (year, openingBalance) => {
  const weekly = await WeeklyContribution.aggregate([
    { $match: { year } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  const puja = await PujaContribution.aggregate([
    { $match: { year } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  const donations = await Donation.aggregate([
    { $match: { year } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  const expenses = await Expense.aggregate([
    { $match: { year, status: "approved" } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  const totalCollection =
    (weekly[0]?.total || 0) +
    (puja[0]?.total || 0) +
    (donations[0]?.total || 0);

  const totalExpenses = expenses[0]?.total || 0;

  const closingBalance =
    openingBalance + totalCollection - totalExpenses;

  return {
    openingBalance,
    totalCollection,
    totalExpenses,
    closingBalance,
  };
};
