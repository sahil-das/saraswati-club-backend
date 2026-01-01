// src/services/finance.service.js
const mongoose = require("mongoose");
const WeeklyPayment = require("../models/WeeklyPayment");
const PujaContribution = require("../models/PujaContribution");
const Donation = require("../models/Donation");
const Expense = require("../models/Expense");
const PujaCycle = require("../models/PujaCycle");

/**
 * Calculates the full financial summary for a specific cycle.
 * @param {string|ObjectId} cycleId
 * @returns {Promise<Object>} Financial summary including opening/closing balances
 */
exports.calculateCycleStats = async (cycleId) => {
  const cycle = await PujaCycle.findById(cycleId);
  if (!cycle) throw new Error("Cycle not found");

  const cycleObjectId = new mongoose.Types.ObjectId(cycleId);

  // 1. Calculate Weekly Totals
  // Logic: Count all 'paid' weeks in this cycle * cycle's weeklyAmount
  const weeklyAgg = await WeeklyPayment.aggregate([
    { $match: { cycle: cycleObjectId } },
    { $unwind: "$weeks" },
    { $match: { "weeks.paid": true } },
    { $count: "paidWeeks" },
  ]);
  
  const totalPaidWeeks = weeklyAgg[0]?.paidWeeks || 0;
  const weeklyTotal = totalPaidWeeks * (cycle.weeklyAmount || 0);

  // 2. Calculate Puja Contributions
  const pujaAgg = await PujaContribution.aggregate([
    { $match: { cycle: cycleObjectId } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const pujaTotal = pujaAgg[0]?.total || 0;

  // 3. Calculate Donations
  const donationAgg = await Donation.aggregate([
    { $match: { cycle: cycleObjectId } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const donationTotal = donationAgg[0]?.total || 0;

  // 4. Calculate Expenses (Approved only)
  const expenseAgg = await Expense.aggregate([
    { $match: { cycle: cycleObjectId, status: "approved" } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const expenseTotal = expenseAgg[0]?.total || 0;

  // 5. Final Balances
  const totalCollection = weeklyTotal + pujaTotal + donationTotal;
  const openingBalance = cycle.openingBalance || 0;
  
  // Closing Balance = Opening + Collections - Expenses
  const closingBalance = openingBalance + totalCollection - expenseTotal;

  return {
    cycleId: cycle._id,
    cycleName: cycle.name,
    isClosed: cycle.isClosed,
    openingBalance,
    weeklyTotal,
    pujaTotal,
    donationTotal,
    totalCollection,
    expenseTotal,
    closingBalance, // This is the calculated running balance
  };
};