const mongoose = require("mongoose");
const { get: getPrice, set: setPrice } = require("../utils/mongooseMoney");

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
  totalInstallments: { type: Number, default: 52 },
  
  // 👈 UPDATED
  amountPerInstallment: { type: Number, get: getPrice, set: setPrice, default: 0 },
  openingBalance: { type: Number, get: getPrice, set: setPrice, default: 0 },
  closingBalance: { type: Number, get: getPrice, set: setPrice, default: 0 },
  
  isActive: { type: Boolean, default: false },
  isClosed: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { 
  timestamps: true,
  toJSON: { getters: true },
  toObject: { getters: true }
});

module.exports = mongoose.model("FestivalYear", festivalYearSchema);