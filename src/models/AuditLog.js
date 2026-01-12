// src/models/AuditLog.js
const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema({
  // 🔽 CHANGE: Remove 'required: true' to allow Platform/System logs
  club: { type: mongoose.Schema.Types.ObjectId, ref: "Club" }, 
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  action: { type: String, required: true },
  target: { type: String },
  details: { type: Object },
  ip: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// INDEXES
auditLogSchema.index({ club: 1, createdAt: -1 }); // Fast filtering by club
// 🔽 NEW INDEX: Fast filtering for Global/Platform Dashboard
auditLogSchema.index({ createdAt: -1 }); 
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 });

module.exports = mongoose.model("AuditLog", auditLogSchema);