const mongoose = require("mongoose");
const mongooseMoney = require("../utils/mongooseMoney"); 

const memberFeeSchema = new mongoose.Schema({
  club: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
  year: { type: mongoose.Schema.Types.ObjectId, ref: "FestivalYear", required: true },
  
  // ⚠️ DEPRECATED: Old field (Keeping for safety/backup)
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  // ✅ NEW FIELD: Link to Membership (Standardizing on this)
  member: { type: mongoose.Schema.Types.ObjectId, ref: "Membership" }, 

  amount: { ...mongooseMoney, required: true },
  
  paidAt: { type: Date, default: Date.now },
  collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  notes: { type: String },

  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

memberFeeSchema.index({ club: 1, isDeleted: 1 });

module.exports = mongoose.model("MemberFee", memberFeeSchema);