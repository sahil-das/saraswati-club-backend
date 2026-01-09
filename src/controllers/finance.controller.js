const mongoose = require("mongoose"); // 👈 Required for ObjectId casting
const FestivalYear = require("../models/FestivalYear");
const Subscription = require("../models/Subscription");
const MemberFee = require("../models/MemberFee");
const Donation = require("../models/Donation");
const Expense = require("../models/Expense");
const { toClient } = require("../utils/mongooseMoney");

exports.getSummary = async (req, res) => {
  try {
    const { clubId } = req.user;

    // 1. Get Active Year
    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    
    if (!activeYear) {
      return res.json({
        success: true,
        data: {
          yearName: "No Active Year",
          openingBalance: "0.00",
          totalIncome: "0.00",
          totalExpense: "0.00",
          balance: "0.00",
          breakdown: { subscriptions: "0.00", memberFees: "0.00", donations: "0.00" }
        }
      });
    }

    const yearId = activeYear._id;

    // ⚠️ CRITICAL FIX: Convert String ID to ObjectId for Aggregation
    const baseMatch = { 
        club: new mongoose.Types.ObjectId(clubId), 
        year: yearId // yearId is already an ObjectId from the doc above
    };

    // 2. AGGREGATE: Subscriptions
    // Note: Subscriptions are "hard transactions" and don't typically use isDeleted yet.
    const subscriptionStats = await Subscription.aggregate([
      { $match: baseMatch }, 
      { $unwind: "$installments" },
      { $match: { "installments.isPaid": true } },
      { $group: { _id: null, total: { $sum: "$installments.amountExpected" } } }
    ]);
    const totalSubscriptionsInt = subscriptionStats[0]?.total || 0;

    // 3. AGGREGATE: Member Fees
    const memberFeeStats = await MemberFee.aggregate([
      { 
        $match: { 
          ...baseMatch, 
          isDeleted: false // 👈 FILTER: Exclude deleted fees
        } 
      },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const totalMemberFeesInt = memberFeeStats[0]?.total || 0;

    // 4. AGGREGATE: Donations
    const donationStats = await Donation.aggregate([
      { 
        $match: { 
          ...baseMatch, 
          isDeleted: false // 👈 FILTER: Exclude deleted donations
        } 
      },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const totalDonationsInt = donationStats[0]?.total || 0;

    // 5. AGGREGATE: Expenses
    const expenseStats = await Expense.aggregate([
      { 
        $match: { 
          ...baseMatch, 
          status: "approved",
          isDeleted: false // 👈 FILTER: Exclude deleted expenses
        } 
      }, 
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const totalExpensesInt = expenseStats[0]?.total || 0;

    // 6. Calculate Totals (All Math in Integers/Paisa)
    // Use { getters: false } to get raw integer (e.g., 50000) instead of "500.00"
    const openingBalanceInt = activeYear.get('openingBalance', null, { getters: false }) || 0;
    
    const currentIncomeInt = totalSubscriptionsInt + totalMemberFeesInt + totalDonationsInt;
    const totalBalanceInt = openingBalanceInt + currentIncomeInt - totalExpensesInt;

    res.json({
      success: true,
      data: {
        yearName: activeYear.name,
        // 7. Convert to Client Format (Rupees) at the very end
        openingBalance: toClient(openingBalanceInt),
        totalIncome: toClient(currentIncomeInt),
        totalExpense: toClient(totalExpensesInt),
        balance: toClient(totalBalanceInt),
        breakdown: {
          subscriptions: toClient(totalSubscriptionsInt),
          memberFees: toClient(totalMemberFeesInt),
          donations: toClient(totalDonationsInt)
        }
      }
    });

  } catch (err) {
    console.error("Finance Summary Error:", err);
    res.status(500).json({ message: "Server error calculating finances" });
  }
};