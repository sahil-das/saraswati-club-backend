const mongoose = require("mongoose");

const memberFeeSchema = new mongoose.Schema({
  club: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
  year: { type: mongoose.Schema.Types.ObjectId, ref: "FestivalYear", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  amount: { type: Number, required: true },
  paidAt: { type: Date, default: Date.now },
  
  collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model("MemberFee", memberFeeSchema);