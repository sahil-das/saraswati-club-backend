// src/models/AuditLog.js
const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema({
  club: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  action: { type: String, required: true },
  target: { type: String },
  details: { type: Object },
  ip: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// INDEXES
// 1. Fast filtering by club (Dashboard)
auditLogSchema.index({ club: 1, createdAt: -1 });

// 2. TTL Index: Automatically delete logs older than 365 days
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 });

module.exports = mongoose.model("AuditLog", auditLogSchema);