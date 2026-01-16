const mongoose = require("mongoose");

const voteSchema = new mongoose.Schema({
  poll: { type: mongoose.Schema.Types.ObjectId, ref: "Poll", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  
  // Store Option ID(s)
  selectedOptionIds: [{ type: String, required: true }] 
}, { timestamps: true });

// 🛡️ Ensure one user votes only ONCE per poll
voteSchema.index({ poll: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("Vote", voteSchema);