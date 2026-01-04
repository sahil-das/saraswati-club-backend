const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    
    // 🔐 SYSTEM LOGIN ID (e.g., rahul@happy-club.com)
    // Auto-generated. STRICTLY for login.
    email: { 
      type: String, 
      required: true, 
      unique: true, 
      lowercase: true 
    },

    // 📧 PERSONAL EMAIL (e.g., rahul.roy@gmail.com)
    // Optional. Used for Notifications.
    personalEmail: { 
      type: String, 
      default: "", 
      lowercase: true,
      trim: true 
    },

    password: { type: String, required: true, select: false },
    phone: { type: String, default: "" },
    
    isPlatformAdmin: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);