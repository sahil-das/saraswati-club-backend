const AuditLog = require("../models/AuditLog");

/**
 * Records an activity in the database.
 * @param {Object} req - Express Request Object (to get user/club info)
 * @param {String} action - Short code (e.g. "UPDATE_SETTINGS")
 * @param {String} target - Human readable target (e.g. "Settings")
 * @param {Object} details - Optional JSON data
 */
exports.logAction = async ({ req, action, target, details }) => {
  try {
    if (!req.user || !req.user.clubId) return;

    await AuditLog.create({
      club: req.user.clubId,
      actor: req.user.id,
      action,
      target,
      details,
      ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress
    });
  } catch (err) {
    console.error("Audit Log Warning:", err.message);
    // We intentionally catch errors so logging failure doesn't stop the main request
  }
};