const mongoose = require("mongoose");
const mongooseMoney = require("../utils/mongooseMoney");

const festivalYearSchema = new mongoose.Schema({
  club: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
  name: { type: String, required: true }, 
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },

  subscriptionFrequency: { 
    type: String, 
    enum: ["weekly", "monthly", "none"],
    required: true 
  },
  
  totalInstallments: { 
    type: Number, 
    default: 52,
    min: [0, "Must have at least 1 installment"],
    max: [53, "Cannot exceed 53 installments (approx 1 year)"] 
  }, 
  
  amountPerInstallment: { ...mongooseMoney, default: 0 },
  openingBalance: { ...mongooseMoney, default: 0 },
  closingBalance: { ...mongooseMoney, default: 0 },
  
  // ✅ NEW: Centralized Category List (This was missing)
  expenseCategories: { 
    type: [String], 
    default: ["Pandal", "Idol", "Light & Sound", "Food/Bhog", "Priest/Puja", "Transport", "Miscellaneous"] 
  },

  isActive: { type: Boolean, default: false },
  isClosed: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { 
  timestamps: true,
  toJSON: { getters: true }, 
  toObject: { getters: true }
});

module.exports = mongoose.model("FestivalYear", festivalYearSchema);