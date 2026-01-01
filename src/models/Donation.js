const mongoose = require("mongoose");

const donationSchema = new mongoose.Schema(
  {
    donorName: {
      type: String,
      trim: true,
      default: "Anonymous", // ✅ fallback
    },
    amount: {
      type: Number,
      required: true,
    },
    cycle: {                      // ✅ THIS IS REQUIRED
      type: mongoose.Schema.Types.ObjectId,
      ref: "PujaCycle",
      required: true,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Donation", donationSchema);
