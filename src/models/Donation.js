const mongoose = require("mongoose");
const mongooseMoney = require("../utils/mongooseMoney");

const donationSchema = new mongoose.Schema({
  club: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
  year: { type: mongoose.Schema.Types.ObjectId, ref: "FestivalYear", required: true },
  donorName: { type: String, required: true, trim: true },
  
  // ✅ NEW: Type of Donation
  type: { 
    type: String, 
    enum: ["cash", "online", "item"], // Added 'item'
    default: "cash" 
  },

  // 🔄 MODIFIED: Amount is 0 for items, required for cash
  amount: { ...mongooseMoney, default: 0 },

  // ✅ NEW: Details for In-Kind Donations
  itemDetails: { 
    itemName: { type: String }, // e.g., "Basmati Rice"
    quantity: { type: String }, // e.g., "50 kg"
    estimatedValue: { type: Number } // Optional: For reporting value
  },

  address: { type: String, default: "" },
  phone: { type: String, default: "" },
  collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: Date, default: Date.now },
  receiptNo: { type: String },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model("Donation", donationSchema);