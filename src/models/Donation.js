const mongoose = require("mongoose");
const mongooseMoney = require("../utils/mongooseMoney");

const donationSchema = new mongoose.Schema({
  club: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
  year: { type: mongoose.Schema.Types.ObjectId, ref: "FestivalYear", required: true },
  
  donorName: { type: String, required: true, trim: true },
  amount: { ...mongooseMoney, required: true, min: 0 },
  
  address: { type: String, default: "" },
  phone: { type: String, default: "" },
  
  collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: Date, default: Date.now },
  receiptNo: { type: String },

  // ✅ NEW: Soft Delete Flag
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

donationSchema.index({ club: 1, isDeleted: 1 });

module.exports = mongoose.model("Donation", donationSchema);