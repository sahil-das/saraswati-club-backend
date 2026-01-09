const mongoose = require("mongoose");
const mongooseMoney = require("../utils/mongooseMoney");

const expenseSchema = new mongoose.Schema({
  club: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
  year: { type: mongoose.Schema.Types.ObjectId, ref: "FestivalYear", required: true },
  
  title: { type: String, required: true },
  amount: { ...mongooseMoney, required: true, min: 0 },
  
  category: { type: String, required: true },
  description: String,
  date: { type: Date, default: Date.now },
  
  status: { 
    type: String, 
    enum: ["pending", "approved", "rejected"], 
    default: "pending" 
  },

  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  // ✅ NEW: Soft Delete Flag
  isDeleted: { type: Boolean, default: false } 
}, { timestamps: true });

expenseSchema.index({ club: 1, year: 1, date: -1 }); 
// Index for filtering deleted items efficiently
expenseSchema.index({ club: 1, isDeleted: 1 });

module.exports = mongoose.model("Expense", expenseSchema);