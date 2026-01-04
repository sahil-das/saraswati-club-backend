const FestivalYear = require("../models/FestivalYear");
const Expense = require("../models/Expense");
const MemberFee = require("../models/MemberFee");
const Donation = require("../models/Donation");
const Subscription = require("../models/Subscription");

/**
 * @desc Get List of Closed Years
 * @route GET /api/v1/archives
 */
exports.getArchivedYears = async (req, res) => {
  try {
    const { clubId } = req.user;
    
    // Fetch only closed years, sorted by most recent
    const closedYears = await FestivalYear.find({ 
      club: clubId, 
      isClosed: true 
    })
    .select("name startDate endDate closingBalance") // Select only needed fields
    .sort({ endDate: -1 });

    res.json({ success: true, data: closedYears });
  } catch (err) {
    console.error("Archive List Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @desc Get Full Report for a Specific Year
 * @route GET /api/v1/archives/:yearId
 */
exports.getArchiveDetails = async (req, res) => {
  try {
    const { yearId } = req.params;
    const { clubId } = req.user;

    // 1. Verify the Year exists and belongs to this club
    const yearDoc = await FestivalYear.findOne({ _id: yearId, club: clubId });
    if (!yearDoc) return res.status(404).json({ message: "Year record not found" });

    // 2. Parallel Fetching for Speed ⚡
    // We use the 'year' field which links data to this specific festival cycle
    const [expenses, fees, donations, subscriptions] = await Promise.all([
      
      // A. Expenses (Only Approved)
      Expense.find({ club: clubId, year: yearId, status: "approved" })
        .sort({ date: -1 }),

      // B. Puja/Festival Fees
      MemberFee.find({ club: clubId, year: yearId })
        .populate("user", "name")
        .sort({ createdAt: -1 }),

      // C. Outside Donations
      Donation.find({ club: clubId, year: yearId })
        .sort({ date: -1 }),

      // D. Subscriptions (For calculating collections if any)
      Subscription.find({ club: clubId, year: yearId })
    ]);

    // 3. Calculate Totals
    const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalFees = fees.reduce((sum, f) => sum + f.amount, 0);
    const totalDonations = donations.reduce((sum, d) => sum + d.amount, 0);
    
    // Calculate Subscription Collection for that year
    // We sum up only 'isPaid' installments
    let totalSubscriptionCollected = 0;
    subscriptions.forEach(sub => {
        sub.installments.forEach(inst => {
            if (inst.isPaid) totalSubscriptionCollected += inst.amountExpected;
        });
    });

    // 4. Construct the Financial Summary
    const financialSummary = {
      openingBalance: yearDoc.openingBalance,
      income: {
        subscriptions: totalSubscriptionCollected,
        fees: totalFees,
        donations: totalDonations,
        total: totalSubscriptionCollected + totalFees + totalDonations
      },
      expense: totalExpense,
      // The stored closing balance is the source of truth, 
      // but we send the calculated one too for verification if needed.
      netBalance: yearDoc.closingBalance 
    };

    res.json({
      success: true,
      data: {
        info: yearDoc,
        summary: financialSummary,
        records: {
          expenses,
          fees,
          donations
        }
      }
    });

  } catch (err) {
    console.error("Archive Detail Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};