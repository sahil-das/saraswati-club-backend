const FestivalYear = require("../models/FestivalYear");
const Expense = require("../models/Expense");
const MemberFee = require("../models/MemberFee");
const Donation = require("../models/Donation");
const Subscription = require("../models/Subscription");
const { toClient } = require("../utils/mongooseMoney"); 

/**
 * @desc    Get List of Closed Years (Archive Index)
 * @route   GET /api/v1/archives
 * @access  Private
 */
exports.getArchivedYears = async (req, res) => {
  try {
    const { clubId } = req.user;
    
    // Fetch only closed years, sorted by most recent
    const closedYears = await FestivalYear.find({ 
      club: clubId, 
      isClosed: true 
    })
    .select("name startDate endDate closingBalance") 
    .sort({ endDate: -1 });

    // Format closingBalance for the client
    const formattedYears = closedYears.map(y => {
        const obj = y.toObject();
        // Access raw value using getters: false, then format
        obj.closingBalance = toClient(y.get('closingBalance', null, { getters: false }));
        return obj;
    });

    res.json({ success: true, data: formattedYears });
  } catch (err) {
    console.error("Archive List Error:", err);
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
      // A. Expenses (Approved only)
      Expense.find({ club: clubId, year: yearId, status: "approved" }).sort({ date: -1 }),
      
      // B. Member Fees (Puja Chanda/Levy)
      MemberFee.find({ club: clubId, year: yearId }).populate("user", "name").sort({ createdAt: -1 }),
      
      // C. Public Donations
      Donation.find({ club: clubId, year: yearId }).sort({ date: -1 }),
      
      // D. Member Subscriptions (Weekly/Monthly)
      // ✅ FIX 1: Populate 'member' to get names for the report
      Subscription.find({ club: clubId, year: yearId }).populate("member", "name")
    ]);

    // 3. Calculate Totals 
    // (Using { getters: false } to access raw integers/cents from DB to ensure math accuracy)

    // Sum Expenses
    const totalExpenseInt = expenses.reduce((sum, e) => {
        return sum + (e.get('amount', null, { getters: false }) || 0);
    }, 0);

    // Sum Fees
    const totalFeesInt = fees.reduce((sum, f) => {
        return sum + (f.get('amount', null, { getters: false }) || 0);
    }, 0);

    // Sum Donations
    const totalDonationsInt = donations.reduce((sum, d) => {
        return sum + (d.get('amount', null, { getters: false }) || 0);
    }, 0);
    
    // Sum Subscriptions (Iterate through paid installments)
    let totalSubscriptionCollectedInt = 0;
    
    // ✅ FIX 2: Create a formatted list for the Frontend PDF/Table
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

        // Return object for the list
        return {
            _id: sub._id,
            memberName: sub.member?.name || "Unknown Member", // Correctly access populated name
            totalPaid: toClient(subTotal)
        };
    }).filter(item => parseFloat(item.totalPaid) > 0); // Only include members who actually paid

    const totalIncomeInt = totalSubscriptionCollectedInt + totalFeesInt + totalDonationsInt;
    
    // Get raw opening/closing balance from the Year Document
    const openingBalanceInt = yearDoc.get('openingBalance', null, { getters: false }) || 0;
    const closingBalanceInt = yearDoc.get('closingBalance', null, { getters: false }) || 0;

    // 4. Mathematical Integrity Check
    // Calculate what the balance *should* be based on the records found
    const calculatedBalanceInt = openingBalanceInt + totalIncomeInt - totalExpenseInt;
    const hasDiscrepancy = calculatedBalanceInt !== closingBalanceInt;

    // 5. Construct Financial Summary (Convert Ints to Strings "0.00" for Client)
    const financialSummary = {
      openingBalance: toClient(openingBalanceInt),
      income: {
        subscriptions: toClient(totalSubscriptionCollectedInt),
        fees: toClient(totalFeesInt),
        donations: toClient(totalDonationsInt),
        total: toClient(totalIncomeInt)
      },
      expense: toClient(totalExpenseInt),
      netBalance: toClient(closingBalanceInt), // The official stored balance
      
      // Debug fields for the frontend to show warnings if needed
      calculatedBalance: toClient(calculatedBalanceInt),
      hasDiscrepancy: hasDiscrepancy
    };

    // 6. Format Individual Records (Map & Convert to Client format)
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
          // ✅ FIX 3: Send the formatted subscription list to the frontend
          subscriptions: formattedSubscriptions 
        }
      }
    });

  } catch (err) {
    console.error("Archive Detail Error:", err);
    res.status(500).json({ message: "Server error fetching archive details" });
  }
};