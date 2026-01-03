const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { 
      type: String, 
      required: true, 
      unique: true, // ✅ Global Uniqueness (One login for all clubs)
      lowercase: true 
    },
    password: { type: String, required: true, select: false }, // Hide by default
    phone: { type: String, default: "" },
    
    // Platform Admin (You) - Can manage the SaaS itself
    isPlatformAdmin: { type: Boolean, default: false },
    
    // ❌ REMOVED: role, club (Moved to Membership)
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);