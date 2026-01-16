const mongoose = require("mongoose"); // 👈 Added Mongoose
const Donation = require("../models/Donation");
const FestivalYear = require("../models/FestivalYear");
const { logAction } = require("../utils/auditLogger");
const { toClient } = require("../utils/mongooseMoney");
const logger = require("../utils/logger");
/**
 * @route POST /api/v1/donations
 * @desc Add a new donation (Cash, Online, or Item)
 */
exports.addDonation = async (req, res) => {
  let session;
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    // 1. Destructure new fields (type, itemDetails)
    const { 
        donorName, amount, address, phone, date, receiptNo, 
        type = "cash", itemDetails 
    } = req.body;
    
    const { clubId, id: userId } = req.user;

    // 2. Validate Input
    if (!donorName || !donorName.trim()) throw new Error("Donor name is required");

    // 🔄 CONDITIONAL VALIDATION: 
    // If Cash/Online -> Amount is required. 
    // If Item -> Item Details are required.
    let finalAmount = 0;
    if (type === "item") {
        if (!itemDetails || !itemDetails.itemName) {
            throw new Error("Item name and quantity are required for item donations.");
        }
        // Optional: User can set an estimated value for the item
        finalAmount = itemDetails.estimatedValue ? Number(itemDetails.estimatedValue) : 0;
    } else {
        // Cash or Online
        if (!amount || isNaN(amount) || Number(amount) <= 0) {
            throw new Error("Valid positive amount is required for cash/online donations.");
        }
        finalAmount = Number(amount);
    }

    const activeYear = await FestivalYear.findOne({ 
        club: clubId, isActive: true, isClosed: false 
    }).session(session);

    if (!activeYear) throw new Error("No active festival year found.");

    // 3. Create Donation
    const [donation] = await Donation.create([{
      club: clubId,
      year: activeYear._id,
      donorName: donorName.trim(),
      type, // 'cash', 'online', 'item'
      amount: finalAmount, 
      itemDetails: type === "item" ? itemDetails : undefined, // Only save if item
      address: address?.trim(),
      phone: phone?.trim(),
      receiptNo: receiptNo?.trim(),
      date: date ? new Date(date) : new Date(),
      collectedBy: userId
    }], { session });

    // 4. Log Action
    const logDetails = type === "item" 
        ? { itemName: itemDetails.itemName, quantity: itemDetails.quantity }
        : { amount: finalAmount, receipt: donation.receiptNo };

    await logAction({
      req,
      action: "DONATION_RECEIVED",
      target: `Donor: ${donation.donorName} (${type})`,
      details: { donationId: donation._id, ...logDetails }
    });

    await session.commitTransaction();
    session.endSession();

    // 5. Format Response
    const donationObj = donation.toObject();
    donationObj.amount = toClient(donation.get('amount', null, { getters: false }));

    res.status(201).json({ success: true, message: "Donation added", data: donationObj });
  } catch (err) {
    if (session) { await session.abortTransaction(); session.endSession(); }
    logger.error("Add Donation Error", { error: err.message, stack: err.stack });
    res.status(500).json({ message: err.message || "Server error" });
  }
};
// ... (getDonations and deleteDonation remain unchanged)
/**
 * @route GET /api/v1/donations
 * @desc Get donations for the ACTIVE year
 */
exports.getDonations = async (req, res) => {
  try {
    const { clubId } = req.user;
    const activeYear = await FestivalYear.findOne({ club: clubId, isActive: true });
    
    if (!activeYear) return res.json({ success: true, data: [] });

    const donations = await Donation.find({ 
        club: clubId, 
        year: activeYear._id,
        isDeleted: false // 👈 FILTER
    })
      .populate("collectedBy", "name")
      .sort({ date: -1 });

    // ... formatting logic ...
    const formattedDonations = donations.map(d => {
        const obj = d.toObject();
        obj.amount = toClient(d.get('amount', null, { getters: false }));
        return obj;
    });

    res.json({ success: true, data: formattedDonations });
  } catch (err) {
    logger.error("Get Donations Error", { 
      error: err.message, 
      stack: err.stack,
      clubId: req.user.clubId 
    });
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @route DELETE /api/v1/donations/:id
 * @desc Delete a donation entry
 */
exports.deleteDonation = async (req, res) => {
  try {
    const { id } = req.params;
    
    const donation = await Donation.findOneAndUpdate(
        { _id: id, club: req.user.clubId },
        { isDeleted: true }, // 👈 SOFT DELETE
        { new: true }
    );

    if (!donation) return res.status(404).json({ message: "Donation not found" });

    await logAction({
      req,
      action: "DONATION_DELETED",
      target: `Deleted Donation: ${donation.donorName}`,
      details: { 
        amount: toClient(donation.get('amount', null, { getters: false })),
        receipt: donation.receiptNo
      }
    });

    res.json({ success: true, message: "Donation deleted successfully" });
  } catch (err) {
    logger.error("Delete Donations Error", { 
      error: err.message, 
      stack: err.stack,
      clubId: req.user.clubId 
    });
    res.status(500).json({ message: "Server error" });
  }
};