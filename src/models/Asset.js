const mongoose = require("mongoose");

const assetSchema = new mongoose.Schema({
  club: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Club",
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    default: 1
  },
  estimatedValue: { 
    type: Number, 
    default: 0
  },
  location: { 
    type: String,
    required: true,
    trim: true
  },
  condition: {
    type: String,
    enum: ["New", "Good", "Fair", "Damaged"],
    default: "Good"
  },
  notes: String,
  
  // ✅ NEW: Soft Delete Flag
  isDeleted: { type: Boolean, default: false }

}, { timestamps: true });

module.exports = mongoose.model("Asset", assetSchema);