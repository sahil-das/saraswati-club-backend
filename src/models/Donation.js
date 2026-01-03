const mongoose = require("mongoose");

const donationSchema = new mongoose.Schema({
  // 🔗 LINKS
  club: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
  year: { type: mongoose.Schema.Types.ObjectId, ref: "FestivalYear", required: true },
  
  // 📝 DETAILS
  donorName: { type: String, required: true, trim: true },
  amount: { type: Number, required: true },
  address: { type: String, default: "" },
  phone: { type: String, default: "" },
  
  // 👤 META
  collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: Date, default: Date.now },
  receiptNo: { type: String } // Optional: For physical receipt tracking
}, { timestamps: true });

module.exports = mongoose.model("Donation", donationSchema);