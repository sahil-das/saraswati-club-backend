const Budget = require("../models/Budget");
const Expense = require("../models/Expense");
const FestivalYear = require("../models/FestivalYear");
const mongooseMoney = require("../utils/mongooseMoney");
const { logAction } = require("../utils/auditLogger");

/**
 * @desc Get Budget Analysis (Hides Deleted)
 */
exports.getBudgetAnalysis = async (req, res) => {
  try {
    const { clubId } = req.user;
    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) return res.json({ success: true, data: [] });

    // ✅ FIX: Only fetch non-deleted budgets
    const budgets = await Budget.find({ 
        club: clubId, 
        year: activeYear._id,
        isDeleted: false 
    });

    const expenseStats = await Expense.aggregate([
        { 
            $match: { 
                club: activeYear.club, 
                year: activeYear._id,
                isDeleted: false,
                status: "approved"
            } 
        },
        { 
            $group: { 
                _id: { $toLower: "$category" },
                totalSpentPaise: { $sum: "$amount" }
            } 
        }
    ]);

    const expenseMap = {};
    expenseStats.forEach(stat => { expenseMap[stat._id] = stat.totalSpentPaise; });

    const analysis = budgets.map(b => {
        const allocatedPaise = mongooseMoney.toDB(b.allocatedAmount);
        const spentPaise = expenseMap[b.category.toLowerCase()] || 0;
        const percentage = allocatedPaise > 0 ? Math.round((spentPaise / allocatedPaise) * 100) : 0;
        
        let status = "good";
        if (percentage >= 100) status = "overbudget";
        else if (percentage >= 90) status = "warning";

        return {
            _id: b._id,
            category: b.category,
            allocated: Number(b.allocatedAmount),
            spent: Number(mongooseMoney.toClient(spentPaise)),
            percentageUsed: percentage,
            status
        };
    });

    res.json({ success: true, data: analysis });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * @desc Set/Update Budget (Handles Reactivation)
 */
exports.setBudget = async (req, res) => {
  try {
    const { clubId } = req.user;
    const { category, amount } = req.body;

    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) return res.status(400).json({ message: "No active financial year." });

    // ✅ FIX: Find existing (even if deleted) and update/restore it
    const budget = await Budget.findOneAndUpdate(
        { club: clubId, year: activeYear._id, category: category }, 
        { 
            allocatedAmount: amount,
            isDeleted: false // Reactivate if it was deleted
        }, 
        { new: true, upsert: true } 
    );

    await logAction({
        req,
        action: "BUDGET_SET",
        target: `${category}: ${amount}`
    });

    res.json({ success: true, data: budget });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * @desc Delete Budget (Soft Delete)
 */
exports.deleteBudget = async (req, res) => {
  try {
    const { id } = req.params;
    const { clubId } = req.user;

    const budget = await Budget.findOneAndUpdate(
        { _id: id, club: clubId },
        { isDeleted: true },
        { new: true }
    );

    if (!budget) return res.status(404).json({ message: "Budget not found" });

    await logAction({
        req,
        action: "BUDGET_DELETED",
        target: budget.category
    });

    res.json({ success: true, message: "Budget deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};