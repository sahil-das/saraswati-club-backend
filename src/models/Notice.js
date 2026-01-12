const mongoose = require("mongoose");

const noticeSchema = new mongoose.Schema({
  // 1. 🔽 CHANGE: Removed 'required: true' to allow Global Notices (club = null)
  club: { type: mongoose.Schema.Types.ObjectId, ref: "Club" },

  title: { type: String, required: true, trim: true },
  message: { type: String, required: true },
  
  // 2. 🚀 NEW: 'type' determines banner color
  type: { 
    type: String, 
    enum: ["info", "success", "warning", "urgent", "maintenance"], 
    default: "info" 
  },
  
  // 3. 🚀 NEW: Expiration for auto-cleanup
  expiresAt: { type: Date }, 

  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

// Auto-delete expired notices
noticeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Notice", noticeSchema);