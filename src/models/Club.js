const mongoose = require("mongoose");
// ✂️ REMOVED: mongooseMoney is no longer needed here

const clubSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true, lowercase: true, trim: true },
  address: { type: String, default: "" },
  contactPhone: { type: String, default: "" },
  
  // ✂️ REMOVED: Settings block deleted. 
  // These rules (frequency, amount, etc.) now live exclusively in 'FestivalYear'.
  
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Club", clubSchema);