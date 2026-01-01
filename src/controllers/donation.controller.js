const Donation = require("../models/Donation");
const PujaCycle = require("../models/PujaCycle");

/* ===== LIST (ACTIVE CYCLE) ===== */
exports.list = async (req, res) => {
  try {
    const cycle = await PujaCycle.findOne({ isActive: true });
    if (!cycle) return res.json({ success: true, data: [], total: 0 });

    const donations = await Donation.find({ cycle: cycle._id })
      .populate("addedBy", "name")
      .sort({ createdAt: -1 });

    const total = donations.reduce((sum, d) => sum + (d.amount || 0), 0);

    res.json({ success: true, data: donations, total });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

/* ===== CREATE ===== */
exports.create = async (req, res) => {
  const { donorName, amount } = req.body;
  const cycle = await PujaCycle.findOne({ isActive: true });

  if (!cycle || cycle.isClosed) {
    return res.status(403).json({ message: "Year is closed." });
  }

  const donation = await Donation.create({
    donorName,
    amount,
    cycle: cycle._id,
    addedBy: req.user._id,
  });

  res.json({ success: true, data: donation });
};