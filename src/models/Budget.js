const mongoose = require("mongoose");
const mongooseMoney = require("../utils/mongooseMoney");

const budgetSchema = new mongoose.Schema({
  club: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Club",
    required: true
  },
  year: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: "FestivalYear",
    required: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  allocatedAmount: { ...mongooseMoney, required: true, min: 0 },
  
  // ✅ NEW: Soft Delete Flag
  isDeleted: { type: Boolean, default: false }

}, { timestamps: true });

// Ensure unique active budget per category/year (ignoring deleted ones is tricky with unique indexes, 
// so we typically just keep the unique index. If you delete "Food", you can't add "Food" again unless we reactivate it.
// To keep it simple: We will just allow editing the existing one or Reactivating it if we add "Food" again.)
budgetSchema.index({ club: 1, year: 1, category: 1 }, { unique: true });

module.exports = mongoose.model("Budget", budgetSchema);