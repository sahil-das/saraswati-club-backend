const mongoose = require("mongoose");

const financialYearSchema = new mongoose.Schema(
  {
    year: {
      type: Number,
      required: true,
      unique: true,
    },

    openingBalance: {
      type: Number,
      default: 0,
    },

    isClosed: {
      type: Boolean,
      default: false,
    },

    closedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "FinancialYear",
  financialYearSchema
);
