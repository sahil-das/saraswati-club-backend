const mongoose = require("mongoose");
const { get: getPrice, set: setPrice } = require("../utils/mongooseMoney");

const donationSchema = new mongoose.Schema({
  club: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
  year: { type: mongoose.Schema.Types.ObjectId, ref: "FestivalYear", required: true },
  donorName: { type: String, required: true, trim: true },
  
  // 👈 UPDATED
  amount: { type: Number, get: getPrice, set: setPrice, required: true },

  address: { type: String, default: "" },
  phone: { type: String, default: "" },
  collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: Date, default: Date.now },
  receiptNo: { type: String }
}, { 
  timestamps: true,
  toJSON: { getters: true },
  toObject: { getters: true }
});

module.exports = mongoose.model("Donation", donationSchema);