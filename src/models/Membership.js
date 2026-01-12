const mongoose = require("mongoose");

const membershipSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  club: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
  
  role: { 
    type: String, 
    enum: ["admin", "member", "treasurer"], 
    default: "member" 
  },
  
  status: { 
    type: String, 
    enum: ["active", "inactive", "banned"], 
    default: "active" 
  },
  isDeleted: { type: Boolean, default: false },
  joinedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// 🛡️ SECURITY: Prevent duplicate membership in the same club
membershipSchema.index({ user: 1, club: 1 }, { unique: true });

module.exports = mongoose.model("Membership", membershipSchema);