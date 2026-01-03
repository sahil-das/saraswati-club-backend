const Donation = require("../models/Donation");
const FestivalYear = require("../models/FestivalYear");

/**
 * @route POST /api/v1/donations
 * @desc Add a new public donation
 */
exports.addDonation = async (req, res) => {
  try {
    const { donorName, amount, address, phone, date, receiptNo } = req.body;
    const { clubId, id: userId } = req.user;

    // 1. Find Active Year
    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    if (!activeYear) return res.status(400).json({ message: "No active festival year found." });

    // 2. Create Donation
    const donation = await Donation.create({
      club: clubId,
      year: activeYear._id,
      donorName,
      amount,
      address,
      phone,
      receiptNo,
      date: date || new Date(),
      collectedBy: userId
    });

    res.status(201).json({ success: true, message: "Donation added", data: donation });
  } catch (err) {
    console.error("Add Donation Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @route GET /api/v1/donations
 * @desc Get donations for the ACTIVE year
 */
exports.getDonations = async (req, res) => {
  try {
    const { clubId } = req.user;
    
    // 1. Find Context
    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    
    // Graceful handling if no year exists yet
    if (!activeYear) return res.json({ success: true, data: [] });

    // 2. Fetch Data
    const donations = await Donation.find({ club: clubId, year: activeYear._id })
      .populate("collectedBy", "name") // Show who collected the cash
      .sort({ date: -1 });

    res.json({ success: true, data: donations });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @route DELETE /api/v1/donations/:id
 * @desc Delete a donation entry
 */
exports.deleteDonation = async (req, res) => {
  try {
    const donation = await Donation.findOneAndDelete({ 
      _id: req.params.id, 
      club: req.user.clubId 
    });

    if (!donation) return res.status(404).json({ message: "Donation not found" });

    res.json({ success: true, message: "Donation deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};