const mongoose = require("mongoose");
const mongooseMoney = require("../utils/mongooseMoney"); // 👈 IMPORT

const expenseSchema = new mongoose.Schema({
  club: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
  year: { type: mongoose.Schema.Types.ObjectId, ref: "FestivalYear", required: true },
  
  title: { type: String, required: true },
  
  // 💰 FIX: Use mongooseMoney
  amount: { ...mongooseMoney, required: true },
  
  category: { type: String, required: true },
  description: String,
  date: { type: Date, default: Date.now },
  
  status: { 
    type: String, 
    enum: ["pending", "approved", "rejected"], 
    default: "pending" 
  },

  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

expenseSchema.index({ club: 1, year: 1, date: -1 }); 
module.exports = mongoose.model("Expense", expenseSchema);