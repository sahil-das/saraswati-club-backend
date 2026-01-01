const PujaContribution = require("../models/PujaContribution");
const PujaCycle = require("../models/PujaCycle");
const User = require("../models/User");

/* ================= LIST (ACTIVE CYCLE) ================= */
exports.list = async (req, res) => {
  try {
    const cycle = await PujaCycle.findOne({ isActive: true });
    if (!cycle) return res.json({ success: true, data: [], total: 0 });

    const data = await PujaContribution.find({ cycle: cycle._id })
      .populate("member", "name email")
      .populate("addedBy", "name")
      .sort({ createdAt: -1 });

    // Calculate total on server
    const total = data.reduce((sum, item) => sum + (item.amount || 0), 0);

    res.json({ success: true, data, total });
  } catch (err) {
    res.status(500).json({ message: "Failed to load puja contributions" });
  }
};

/* ================= MEMBER TOTAL (ACTIVE CYCLE) ================= */
exports.memberTotal = async (req, res) => {
  try {
    const { memberId } = req.params;

    const cycle = await PujaCycle.findOne({ isActive: true });
    if (!cycle) {
      return res.json({ success: true, total: 0, records: [] });
    }

    const rows = await PujaContribution.find({
      member: memberId,
      cycle: cycle._id,
    }).sort({ createdAt: -1 });

    const total = rows.reduce((sum, r) => sum + r.amount, 0);

    res.json({
      success: true,
      total,
      records: rows,
    });
  } catch (err) {
    console.error("Member puja total error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= SUMMARY (ACTIVE CYCLE, ALL MEMBERS) ================= */
exports.summary = async (req, res) => {
  try {
    const cycle = await PujaCycle.findOne({ isActive: true });
    if (!cycle) {
      return res.json({ success: true, data: [] });
    }

    const rows = await PujaContribution.aggregate([
      {
        $match: { cycle: cycle._id },
      },
      {
        $group: {
          _id: "$member",
          total: { $sum: "$amount" },
        },
      },
    ]);

    const result = rows.map((r) => ({
      memberId: r._id,
      total: r.total,
      paid: r.total > 0,
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    console.error("Puja summary error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= CREATE ================= */
exports.create = async (req, res) => {
  try {
    const { memberId, amount } = req.body;
    const cycle = await PujaCycle.findOne({ isActive: true });

    if (!cycle || cycle.isClosed) {
      return res.status(403).json({ message: "Year is closed." });
    }

    const contribution = await PujaContribution.create({
      member: memberId,
      amount,
      cycle: cycle._id,
      addedBy: req.user._id,
    });

    res.status(201).json({ success: true, data: contribution });
  } catch (err) {
    res.status(500).json({ message: "Create failed" });
  }
};
