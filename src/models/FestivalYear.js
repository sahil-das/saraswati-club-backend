const mongoose = require("mongoose");

const festivalYearSchema = new mongoose.Schema({
  club: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
  name: { type: String, required: true }, 
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },

  // ⚙️ THE RULES FOR THIS SPECIFIC YEAR
  subscriptionFrequency: { 
    type: String, 
    enum: ["weekly", "monthly", "none"],
    required: true 
  },
  totalInstallments: { type: Number, default: 52 }, // e.g. 40 weeks
  amountPerInstallment: { type: Number, default: 0 }, // e.g. 20 Rs
  
  openingBalance: { type: Number, default: 0 },
  closingBalance: { type: Number, default: 0 },
  
  isActive: { type: Boolean, default: false },
  isClosed: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

// ... index ...
module.exports = mongoose.model("FestivalYear", festivalYearSchema);