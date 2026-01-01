const Expense = require("../models/Expense");
const PujaCycle = require("../models/PujaCycle");

/* ===== LIST (ACTIVE CYCLE) ===== */
exports.list = async (req, res) => {
  try {
    const cycle = await PujaCycle.findOne({ isActive: true });
    if (!cycle) return res.json({ success: true, data: [], totalApproved: 0 });

    const expenses = await Expense.find({ cycle: cycle._id })
      .populate("addedBy", "name")
      .sort({ createdAt: -1 });

    // Server-side calculation to guarantee match with Dashboard
    const totalApproved = expenses
      .filter((e) => e.status === "approved")
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    res.json({
      success: true,
      data: expenses,
      totalApproved, // Frontend should display this
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

/* ===== CREATE ===== */
exports.create = async (req, res) => {
  const { title, amount } = req.body;
  const cycle = await PujaCycle.findOne({ isActive: true });

  if (!cycle || cycle.isClosed) {
    return res.status(403).json({ message: "Year is closed." });
  }

  const expense = await Expense.create({
    title,
    amount,
    cycle: cycle._id,
    addedBy: req.user._id,
    status: "pending",
  });

  res.json({ success: true, data: expense });
};

/* ===== APPROVE ===== */
exports.approve = async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  const cycle = await PujaCycle.findOne({ _id: expense.cycle });
  
  if (cycle.isClosed) return res.status(403).json({ message: "Year is closed." });

  expense.status = "approved";
  await expense.save();
  res.json({ success: true });
};

/* ===== REJECT ===== */
exports.reject = async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  // We can reject even if closed? Usually no, strict accounting.
  const cycle = await PujaCycle.findOne({ _id: expense.cycle });
  if (cycle.isClosed) return res.status(403).json({ message: "Year is closed." });

  expense.status = "rejected";
  await expense.save();
  res.json({ success: true });
};