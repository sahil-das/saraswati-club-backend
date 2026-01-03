const mongoose = require("mongoose");

const festivalYearSchema = new mongoose.Schema(
  {
    // 🔗 TENANCY: Belongs to one specific club
    club: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
      required: true
    },

    name: { type: String, required: true, trim: true }, // e.g. "Durga Puja 2025"
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    // 📸 RULES SNAPSHOT: 
    // We save these *at creation time* so that if the club changes rules later,
    // this specific year's data remains accurate.
    subscriptionFrequency: { 
      type: String, 
      enum: ["weekly", "monthly", "none"],
      required: true 
    },
    totalInstallments: { type: Number, default: 52 }, // e.g. 52 or 12
    amountPerInstallment: { type: Number, default: 0 }, 

    // Accounting
    openingBalance: { type: Number, default: 0 }, // Carried from last year
    closingBalance: { type: Number, default: 0 },

    // Status
    isActive: { type: Boolean, default: false }, // Only ONE active year per club
    isClosed: { type: Boolean, default: false }, // Read-only archive

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

// 🔒 Constraint: Only one Active Year per Club
festivalYearSchema.index(
  { club: 1, isActive: 1 }, 
  { unique: true, partialFilterExpression: { isActive: true } }
);

module.exports = mongoose.model("FestivalYear", festivalYearSchema);