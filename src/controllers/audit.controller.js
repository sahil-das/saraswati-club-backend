const AuditLog = require("../models/AuditLog");

exports.getLogs = async (req, res) => {
  try {
    // 1. Fetch Logs for this Club
    const logs = await AuditLog.find({ club: req.user.clubId })
      .populate("actor", "name email") // Get Admin Name
      .sort({ createdAt: -1 }) // Newest first
      .limit(100); // Limit to last 100 to keep it fast

    res.json({ success: true, data: logs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error fetching logs" });
  }
};