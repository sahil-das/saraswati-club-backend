const mongoose = require("mongoose");

const noticeSchema = new mongoose.Schema({
  club: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true },
  
  // Type determines the color (Info=Blue, Warning=Yellow, Urgent=Red)
  type: { 
    type: String, 
    enum: ["info", "event", "urgent"], 
    default: "info" 
  },
  
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Notice", noticeSchema);