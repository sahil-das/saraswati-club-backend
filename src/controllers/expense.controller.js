const mongoose = require("mongoose"); // 👈 Added Mongoose
const Expense = require("../models/Expense");
const FestivalYear = require("../models/FestivalYear");
const { logAction } = require("../utils/auditLogger");
const { toClient } = require("../utils/mongooseMoney");
const logger = require("../utils/logger");
// 1. ADD EXPENSE (Safe Transactional)
exports.addExpense = async (req, res) => {
  let session;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const { title, amount, category, description, date } = req.body;
    const { clubId, role } = req.user; 

    // ✅ VALIDATION
    if (!title || !title.trim()) {
        throw new Error("Expense title is required.");
    }
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
        throw new Error("Please enter a valid positive amount.");
    }
    if (!category) {
        throw new Error("Category is required.");
    }

    // ✅ RACE CONDITION FIX: Fetch Year INSIDE Transaction
    const activeYear = await FestivalYear.findOne({ 
        club: clubId, 
        isActive: true,
        isClosed: false // 🔒 Strict Check
    }).session(session);

    if (!activeYear) throw new Error("No active festival year found or year is closed.");

    const initialStatus = role === "admin" ? "approved" : "pending";

    const [newExpense] = await Expense.create([{
      club: clubId,
      year: activeYear._id,
      title: title.trim(),
      amount: Number(amount),
      category,
      description,
      date: date || new Date(),
      status: initialStatus,
      recordedBy: req.user.id
    }], { session });

    // ✅ LOG
    const actionType = role === "admin" ? "CREATE_EXPENSE_APPROVED" : "CREATE_EXPENSE_REQUEST";
    
    await logAction({
      req,
      action: actionType,
      target: `Expense: ${title} (Rs.${amount})`,
      details: { 
        expenseId: newExpense._id, 
        category, 
        status: initialStatus 
      }
    });

    await session.commitTransaction();
    session.endSession();

    // 💰 Format Response
    const expenseObj = newExpense.toObject();
    expenseObj.amount = toClient(newExpense.get('amount', null, { getters: false }));

    res.status(201).json({ 
      success: true, 
      data: expenseObj,
      message: role === "admin" ? "Expense added." : "Expense submitted for approval."
    });

  } catch (err) {
    if (session) {
        await session.abortTransaction();
        session.endSession();
    }
    console.error(err);
    res.status(500).json({ message: err.message || "Server Error" });
  }
};

// ... (Rest of the controller remains the same: updateStatus, getExpenses, deleteExpense)
// Just ensure you add 'const mongoose = require("mongoose")' at the top.
// 2. APPROVE / REJECT
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; 

    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only Admins can approve expenses." });
    }

    const expense = await Expense.findByIdAndUpdate(
      id, 
      { status }, 
      { new: true }
    );

    if (!expense) return res.status(404).json({ message: "Expense not found" });

    // ✅ LOG
    await logAction({
      req,
      action: `EXPENSE_${status.toUpperCase()}`,
      target: `Expense: ${expense.title}`,
      details: { 
        amount: expense.amount, 
        expenseId: expense._id,
        newStatus: status
      }
    });

    // 💰 FIX: Format Response
    const expenseObj = expense.toObject();
    expenseObj.amount = toClient(expense.get('amount', null, { getters: false }));

    res.json({ success: true, data: expenseObj });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

// 3. GET EXPENSES
exports.getExpenses = async (req, res) => {
  try {
    const { clubId } = req.user;
    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });

    if (!activeYear) return res.json({ success: true, data: [] });

    const expenses = await Expense.find({ 
        club: clubId,
        year: activeYear._id,
        isDeleted: false // 👈 ONLY ACTIVE RECORDS
      })
      .populate("recordedBy", "name")
      .sort({ date: -1 });
    
    // ... formatting logic ...
    const formattedExpenses = expenses.map(e => {
        const obj = e.toObject();
        obj.amount = toClient(e.get('amount', null, { getters: false }));
        return obj;
    });

    res.json({ success: true, data: formattedExpenses });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
};
// 4. DELETE EXPENSE
exports.deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { clubId } = req.user;

    // Use findOneAndUpdate to set flag instead of findOneAndDelete
    const expense = await Expense.findOneAndUpdate(
        { _id: id, club: clubId },
        { isDeleted: true }, // 👈 MARK AS DELETED
        { new: true }
    );

    if (!expense) return res.status(404).json({ message: "Expense not found" });

    // Log the action (Auditors can still see the record in DB if needed)
    await logAction({
      req,
      action: "DELETE_EXPENSE",
      target: `Deleted: ${expense.title}`,
      details: { 
        amount: toClient(expense.get('amount', null, { getters: false })), 
        category: expense.category 
      }
    });

    res.json({ success: true, message: "Expense deleted" });

  } catch (err) {
    logger.error("Delete Expanse Error", { 
      error: err.message, 
      stack: err.stack,
      clubId: req.user.clubId 
    });
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ NEW: Get Categories from Active Year Settings
exports.getExpenseCategories = async (req, res) => {
  try {
    const { clubId } = req.user;

    // Find Active Year
    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    
    // If no active year, return empty defaults
    if (!activeYear) {
        return res.json({ success: true, data: ["Miscellaneous"] });
    }

    // Return the list saved in Settings
    res.json({ success: true, data: activeYear.expenseCategories.sort() });

  } catch (err) {
    console.error("Get Categories Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};