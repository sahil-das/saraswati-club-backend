const FestivalYear = require("../models/FestivalYear");
const Expense = require("../models/Expense");
const MemberFee = require("../models/MemberFee");
const Donation = require("../models/Donation");
const Subscription = require("../models/Subscription");
const { toClient } = require("../utils/mongooseMoney"); 
const logger = require("../utils/logger");
/**
 * @desc    Get List of Closed Years (Archive Index)
 * @route   GET /api/v1/archives
 * @access  Private
 */
exports.getArchivedYears = async (req, res) => {
  try {
    const { clubId } = req.user;
    
    // Fetch only closed years, sorted by MOST RECENTLY CREATED
    const closedYears = await FestivalYear.find({ 
      club: clubId, 
      isClosed: true 
    })
    .select("name startDate endDate closingBalance createdAt") 
    .sort({ createdAt: -1 });

    // Format closingBalance for the client
    const formattedYears = closedYears.map(y => {
        const obj = y.toObject();
        obj.closingBalance = toClient(y.get('closingBalance', null, { getters: false }));
        return obj;
    });

    res.json({ success: true, data: formattedYears });
  } catch (err) {
    logger.error("Archive List Error:", err);
    res.status(500).json({ message: "Server error fetching archives" });
  }
};

/**
 * @desc    Get Full Financial Report for a Specific Year
 * @route   GET /api/v1/archives/:yearId
 * @access  Private
 */
exports.getArchiveDetails = async (req, res) => {
  try {
    const { yearId } = req.params;
    const { clubId } = req.user;

    // 1. Verify the Year exists
    const yearDoc = await FestivalYear.findOne({ _id: yearId, club: clubId });
    if (!yearDoc) {
      return res.status(404).json({ message: "Year record not found" });
    }

    // 2. Parallel Fetching of all related records
    const [expenses, fees, donations, subscriptions] = await Promise.all([
      // A. Expenses
      Expense.find({ 
          club: clubId, 
          year: yearId, 
          status: "approved",
          isDeleted: false 
      }).sort({ date: -1 }),
      
      // B. Member Fees
      MemberFee.find({ 
          club: clubId, 
          year: yearId,
          isDeleted: false 
      }).populate("user", "name").sort({ createdAt: -1 }),
      
      // C. Public Donations
      Donation.find({ 
          club: clubId, 
          year: yearId,
          isDeleted: false 
      }).sort({ date: -1 }),
      
      // D. Member Subscriptions
      // 🚨 FIX: Nested Populate (Subscription -> Membership -> User)
      Subscription.find({ club: clubId, year: yearId })
        .populate({
            path: "member",          // 1. Go to Membership
            populate: {
                path: "user",        // 2. Go to User (inside Membership)
                select: "name"       // 3. Select Name
            }
        })
    ]);

    // 3. Calculate Totals 
    const totalExpenseInt = expenses.reduce((sum, e) => {
        return sum + (e.get('amount', null, { getters: false }) || 0);
    }, 0);

    const totalFeesInt = fees.reduce((sum, f) => {
        return sum + (f.get('amount', null, { getters: false }) || 0);
    }, 0);

    const totalDonationsInt = donations.reduce((sum, d) => {
        return sum + (d.get('amount', null, { getters: false }) || 0);
    }, 0);
    
    let totalSubscriptionCollectedInt = 0;
    
    // Create a formatted list for the Frontend PDF/Table
    const formattedSubscriptions = subscriptions.map(sub => {
        let subTotal = 0;
        if (sub.installments) {
            sub.installments.forEach(inst => {
                if (inst.isPaid) {
                    const amount = inst.get('amountExpected', null, { getters: false }) || 0;
                    subTotal += amount;
                }
            });
        }
        totalSubscriptionCollectedInt += subTotal;

        return {
            _id: sub._id,
            // 🚨 FIX: Access name via nested path (member -> user -> name)
            memberName: sub.member?.user?.name || "Unknown Member", 
            totalPaid: toClient(subTotal)
        };
    }).filter(item => parseFloat(item.totalPaid) > 0);

    const totalIncomeInt = totalSubscriptionCollectedInt + totalFeesInt + totalDonationsInt;
    
    const openingBalanceInt = yearDoc.get('openingBalance', null, { getters: false }) || 0;
    const closingBalanceInt = yearDoc.get('closingBalance', null, { getters: false }) || 0;

    // 4. Mathematical Integrity Check
    const calculatedBalanceInt = openingBalanceInt + totalIncomeInt - totalExpenseInt;
    const hasDiscrepancy = calculatedBalanceInt !== closingBalanceInt;

    // 5. Construct Financial Summary
    const financialSummary = {
      openingBalance: toClient(openingBalanceInt),
      income: {
        subscriptions: toClient(totalSubscriptionCollectedInt),
        fees: toClient(totalFeesInt),
        donations: toClient(totalDonationsInt),
        total: toClient(totalIncomeInt)
      },
      expense: toClient(totalExpenseInt),
      netBalance: toClient(closingBalanceInt), 
      calculatedBalance: toClient(calculatedBalanceInt),
      hasDiscrepancy: hasDiscrepancy
    };

    // 6. Format Individual Records
    const formattedExpenses = expenses.map(e => {
        const obj = e.toObject();
        obj.amount = toClient(e.get('amount', null, { getters: false }));
        return obj;
    });

    const formattedFees = fees.map(f => {
        const obj = f.toObject();
        obj.amount = toClient(f.get('amount', null, { getters: false }));
        return obj;
    });

    const formattedDonations = donations.map(d => {
        const obj = d.toObject();
        obj.amount = toClient(d.get('amount', null, { getters: false }));
        return obj;
    });

    res.json({
      success: true,
      data: {
        info: yearDoc, 
        summary: financialSummary,
        records: {
          expenses: formattedExpenses,
          fees: formattedFees,
          donations: formattedDonations,
          subscriptions: formattedSubscriptions 
        }
      }
    });

  } catch (err) {
    // Captures the error in a structured format for production logs
    logger.error("Archive Detail Error", { 
      error: err.message, 
      stack: err.stack,
      yearId: req.params.yearId 
    });
    res.status(500).json({ message: "Server error fetching archive details" });
  }
};