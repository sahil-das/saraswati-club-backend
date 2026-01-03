const FestivalYear = require("../models/FestivalYear");
const Subscription = require("../models/Subscription");
const MemberFee = require("../models/MemberFee");
const Donation = require("../models/Donation");
const Expense = require("../models/Expense");

/**
 * @route GET /api/v1/finance/summary
 * @desc Get global financial status for the ACTIVE year (Dashboard Stats)
 */
exports.getSummary = async (req, res) => {
  try {
    const { clubId } = req.user;

    // 1. Get Active Year
    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    
    // If no year exists yet, return zeroes
    if (!activeYear) {
      return res.json({
        success: true,
        data: {
          yearName: "No Active Year",
          totalIncome: 0,
          totalExpense: 0,
          balance: 0,
          breakdown: { subscriptions: 0, memberFees: 0, donations: 0 }
        }
      });
    }

    const yearId = activeYear._id;

    // 2. AGGREGATE: Subscriptions (Weekly/Monthly)
    // We sum up the 'amountExpected' of all installments that are marked 'isPaid: true'
    const subscriptionStats = await Subscription.aggregate([
      { $match: { club: clubId, year: yearId } },
      { $unwind: "$installments" },
      { $match: { "installments.isPaid": true } },
      { $group: { _id: null, total: { $sum: "$installments.amountExpected" } } }
    ]);
    const totalSubscriptions = subscriptionStats[0]?.total || 0;

    // 3. AGGREGATE: Member Fees (Chanda)
    const memberFeeStats = await MemberFee.aggregate([
      { $match: { club: clubId, year: yearId } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const totalMemberFees = memberFeeStats[0]?.total || 0;

    // 4. AGGREGATE: Donations (Public)
    const donationStats = await Donation.aggregate([
      { $match: { club: clubId, year: yearId } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const totalDonations = donationStats[0]?.total || 0;

    // 5. AGGREGATE: Expenses
    const expenseStats = await Expense.aggregate([
      { $match: { club: clubId, year: yearId } }, // Include 'status: approved' if you want
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const totalExpenses = expenseStats[0]?.total || 0;

    // 6. Final Calculation
    const openingBalance = activeYear.openingBalance || 0;
    const currentIncome = totalSubscriptions + totalMemberFees + totalDonations;
    const totalBalance = openingBalance + currentIncome - totalExpenses;

    res.json({
      success: true,
      data: {
        yearName: activeYear.name,
        openingBalance,
        totalIncome: currentIncome,
        totalExpense: totalExpenses,
        balance: totalBalance,
        breakdown: {
          subscriptions: totalSubscriptions,
          memberFees: totalMemberFees,
          donations: totalDonations
        }
      }
    });

  } catch (err) {
    console.error("Finance Summary Error:", err);
    res.status(500).json({ message: "Server error calculating finances" });
  }
};