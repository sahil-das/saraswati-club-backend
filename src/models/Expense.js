const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema({
  // 🔗 LINKS
  club: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
  year: { type: mongoose.Schema.Types.ObjectId, ref: "FestivalYear", required: true },
  
  // 📝 DETAILS
  title: { type: String, required: true, trim: true },
  amount: { type: Number, required: true },
  category: { type: String, default: "General" }, // e.g. "Food", "Decoration"
  
  // 👤 META
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "approved" },
  date: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model("Expense", expenseSchema);