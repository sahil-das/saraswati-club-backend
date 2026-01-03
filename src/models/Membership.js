const mongoose = require("mongoose");

const membershipSchema = new mongoose.Schema({
  // Link to the Global User
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  
  // Link to the Specific Club
  club: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Club",
    required: true
  },
  
  // Role within THIS specific club
  role: {
    type: String,
    enum: ["admin", "member", "treasurer"], 
    default: "member"
  },

  // Status (Active/Inactive allows banning/removing without deleting history)
  status: {
    type: String,
    enum: ["active", "inactive", "banned"],
    default: "active"
  },

  joinedAt: { type: Date, default: Date.now }
});

// 🔒 CRITICAL: A user can only join the SAME club ONCE
membershipSchema.index({ user: 1, club: 1 }, { unique: true });

module.exports = mongoose.model("Membership", membershipSchema);