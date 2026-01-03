const Expense = require("../models/Expense");
const FestivalYear = require("../models/FestivalYear");

exports.addExpense = async (req, res) => {
  try {
    const { title, amount, category, date } = req.body;
    const { clubId, id: userId } = req.user;

    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) return res.status(400).json({ message: "No active year found" });

    const expense = await Expense.create({
      club: clubId,
      year: activeYear._id,
      title,
      amount,
      category,
      date: date || new Date(),
      addedBy: userId,
      status: "approved" // Auto-approve for now (or 'pending' if you want workflow)
    });

    res.status(201).json({ success: true, data: expense });
  } catch (err) {
    res.status(500).json({ message: "Failed to add expense" });
  }
};

exports.getExpenses = async (req, res) => {
  try {
    const { clubId } = req.user;
    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    
    // If no year, return empty list (don't crash)
    if (!activeYear) return res.json({ success: true, data: [] });

    const expenses = await Expense.find({ club: clubId, year: activeYear._id })
      .populate("addedBy", "name")
      .sort({ date: -1 });

    res.json({ success: true, data: expenses });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    await Expense.findOneAndDelete({ _id: req.params.id, club: req.user.clubId });
    res.json({ success: true, message: "Expense deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};