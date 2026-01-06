const mongoose = require("mongoose");
const { get: getPrice, set: setPrice } = require("../utils/mongooseMoney");

const expenseSchema = new mongoose.Schema({
  club: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
  year: { type: mongoose.Schema.Types.ObjectId, ref: "FestivalYear", required: true },
  
  title: { type: String, required: true },
  
  // 👈 UPDATED
  amount: { type: Number, get: getPrice, set: setPrice, required: true },

  category: { type: String, required: true },
  description: String,
  date: { type: Date, default: Date.now },
  status: { 
    type: String, 
    enum: ["pending", "approved", "rejected"], 
    default: "pending" 
  },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { 
  timestamps: true,
  toJSON: { getters: true }, // IMPORTANT: Enables the getter when sending JSON
  toObject: { getters: true }
});

module.exports = mongoose.model("Expense", expenseSchema);