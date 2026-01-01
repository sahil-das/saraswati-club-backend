const Donation = require("../models/Donation");
const PujaCycle = require("../models/PujaCycle");

/* ===== LIST (ACTIVE CYCLE) ===== */
exports.list = async (req, res) => {
  const cycle = await PujaCycle.findOne({ isActive: true });
  if (!cycle) return res.json({ success: true, data: [] });

  const donations = await Donation.find({
 
    cycle: cycle._id,
  })
    .populate("addedBy", "name email")
    .sort({ createdAt: -1 });

  res.json({ success: true, data: donations });
};

/* ===== CREATE ===== */
exports.create = async (req, res) => {
  const { donorName, amount } = req.body;
  if (!donorName || !amount) {
    return res.status(400).json({ message: "All fields required" });
  }

  const cycle = await PujaCycle.findOne({ isActive: true });

    // 🔒 Prevent edits to closed year
  if (!cycle || cycle.isClosed) {
    return res.status(403).json({
      message: "This year is closed. Cannot add donation.",
    });
  }

  const donation = await Donation.create({
    donorName,
    amount,
    cycle: cycle._id,
    addedBy: req.user._id,
  });

  res.json({ success: true, data: donation });
};