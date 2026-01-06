const mongoose = require("mongoose");
const { get: getPrice, set: setPrice } = require("../utils/mongooseMoney");

const memberFeeSchema = new mongoose.Schema({
  club: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
  year: { type: mongoose.Schema.Types.ObjectId, ref: "FestivalYear", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  // 👈 UPDATED
  amount: { type: Number, get: getPrice, set: setPrice, required: true },

  paidAt: { type: Date, default: Date.now },
  collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  notes: { type: String }
}, { 
  timestamps: true,
  toJSON: { getters: true },
  toObject: { getters: true }
});

module.exports = mongoose.model("MemberFee", memberFeeSchema);