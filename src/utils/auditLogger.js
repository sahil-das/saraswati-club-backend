// src/utils/auditLogger.js
const AuditLog = require("../models/AuditLog");

exports.logAction = async ({ req, action, target, details, session = null }) => {
  // 1. Basic Security Check
  if (!req.user) return;

  // 🔽 CHANGE: Allow if User has Club OR is Platform Admin
  const hasAccess = req.user.clubId || req.user.isPlatformAdmin;
  if (!hasAccess) return;

  // 2. Prepare Data
  const logData = {
    actor: req.user._id, // or req.user.id
    action,
    target,
    details,
    ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress
  };

  // Only attach club if it exists (Platform actions won't have this)
  if (req.user.clubId) {
    logData.club = req.user.clubId;
  }

  // 3. Create Log
  await AuditLog.create([logData], { session });
};