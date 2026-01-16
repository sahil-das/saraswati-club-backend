const mongoose = require("mongoose");

const pollSchema = new mongoose.Schema({
  club: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  
  question: { type: String, required: true },
  description: String,
  
  // Configuration
  isAnonymous: { type: Boolean, default: false }, // If true, hides WHO voted for WHAT
  allowMultipleChoices: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true },
  isActive: { type: Boolean, default: true },

  // Options (e.g., ["Red", "Blue", "Green"])
  options: [{
    id: { type: String, required: true }, // unique ID for option (e.g., "opt_1")
    text: { type: String, required: true }
  }]
}, { timestamps: true });

module.exports = mongoose.model("Poll", pollSchema);