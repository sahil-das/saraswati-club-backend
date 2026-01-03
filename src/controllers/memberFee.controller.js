const MemberFee = require("../models/MemberFee");
const FestivalYear = require("../models/FestivalYear");

/**
 * @route POST /api/v1/member-fees
 * @desc Record a payment (Chanda) from a member
 */
exports.createPayment = async (req, res) => {
  try {
    const { userId, amount, notes } = req.body;
    const { clubId, id: adminId } = req.user;

    // 1. Get Active Year
    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) return res.status(404).json({ message: "No active festival year." });

    // 2. Create Payment Record
    const fee = await MemberFee.create({
      club: clubId,
      year: activeYear._id,
      user: userId,
      amount,
      collectedBy: adminId,
      notes
    });

    res.status(201).json({ success: true, message: "Payment recorded", data: fee });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @route GET /api/v1/member-fees
 * @desc Get all fees collected for the ACTIVE year
 */
exports.getAllFees = async (req, res) => {
  try {
    const { clubId } = req.user;
    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) return res.status(404).json({ message: "No active year." });

    const fees = await MemberFee.find({ club: clubId, year: activeYear._id })
      .populate("user", "name email")
      .populate("collectedBy", "name")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: fees });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @route DELETE /api/v1/member-fees/:id
 * @desc Delete a wrong entry
 */
exports.deletePayment = async (req, res) => {
  try {
    const fee = await MemberFee.findOneAndDelete({ _id: req.params.id, club: req.user.clubId });
    if (!fee) return res.status(404).json({ message: "Record not found" });
    res.json({ success: true, message: "Record deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};