const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema({
  club: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // The Admin
  action: { type: String, required: true }, // e.g., "PAYMENT_COLLECTED"
  target: { type: String }, // e.g., "Rahul Roy (Member)"
  details: { type: Object }, // Extra info (e.g., amount: 500)
  ip: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("AuditLog", auditLogSchema);