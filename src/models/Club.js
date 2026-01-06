const mongoose = require("mongoose");

const clubSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  // Unique ID for URLs/Invites (e.g., "netaji-club-2026")
  code: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true,
    trim: true 
  },
  address: { type: String, default: "" },
  contactPhone: { type: String, default: "" },
  
  // ⚙️ GLOBAL SETTINGS FOR THIS CLUB
  settings: {
    // Controls if they collect money Weekly, Monthly, or Manual-only
    contributionFrequency: {
      type: String,
      enum: ["weekly", "monthly", "none"], 
      default: "weekly"
    },
    // Default slots: 52 for Weekly, 12 for Monthly
    defaultInstallmentCount: {
      type: Number,
      default: 52 
    },
    // Optional: Default amount per slot (e.g., 20 Rs)
    defaultAmountPerInstallment: {

      type: Number,
      get: require("../utils/mongooseMoney").get,
      set: require("../utils/mongooseMoney").set,
      default: 0
    },
    currency: { type: String, default: "INR" }
  },
  
  // The creator/owner of the club
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Club", clubSchema);