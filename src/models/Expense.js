const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema({
  club: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
  year: { type: mongoose.Schema.Types.ObjectId, ref: "FestivalYear", required: true },
  
  title: { type: String, required: true },
  amount: { type: Number, required: true },
  category: { type: String, required: true },
  description: String,
  date: { type: Date, default: Date.now },
  
  // 🆕 NEW FIELD: Approval Status
  status: { 
    type: String, 
    enum: ["pending", "approved", "rejected"], 
    default: "pending" 
  },

  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

module.exports = mongoose.model("Expense", expenseSchema);