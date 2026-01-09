const mongoose = require("mongoose");
const mongooseMoney = require("../utils/mongooseMoney"); 

const memberFeeSchema = new mongoose.Schema({
  club: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
  year: { type: mongoose.Schema.Types.ObjectId, ref: "FestivalYear", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  amount: { ...mongooseMoney, required: true },
  
  paidAt: { type: Date, default: Date.now },
  collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  notes: { type: String },

  // ✅ NEW: Soft Delete Flag
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

memberFeeSchema.index({ club: 1, isDeleted: 1 });

module.exports = mongoose.model("MemberFee", memberFeeSchema);