// src/models/PujaCycle.js
const mongoose = require("mongoose");

const pujaCycleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g. "2025-2026"
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    
    // Critical for calculating weekly totals correctly for THIS specific year
    weeklyAmount: { type: Number, required: true, default: 0 }, 
    totalWeeks: { type: Number, required: true, default: 52 },

    // Accounting Fields
    openingBalance: { type: Number, default: 0 }, // Brought forward from prev year
    closingBalance: { type: Number, default: 0 }, // Final balance when closed

    // Status Flags
    isActive: { type: Boolean, default: false }, // Only one cycle can be true
    isClosed: { type: Boolean, default: false }, // If true, data is Read-Only

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    closedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PujaCycle", pujaCycleSchema);