const Notice = require("../models/Notice");
const { logAction } = require("../utils/auditLogger"); // 👈 IMPORT

// Get all notices
exports.getNotices = async (req, res) => {
  try {
    const { clubId } = req.user;
    const notices = await Notice.find({ club: clubId })
      .sort({ createdAt: -1 })
      .populate("postedBy", "name");
      
    res.json({ success: true, data: notices });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
};

// Create a new notice (Admin Only)
exports.createNotice = async (req, res) => {
  try {
    const { clubId, id: userId } = req.user;
    const { title, message, type } = req.body;

    // ✅ VALIDATION
    if (!title || !message) {
      return res.status(400).json({ message: "Title and message are required." });
    }

    const newNotice = await Notice.create({
      club: clubId,
      postedBy: userId,
      title,
      message,
      type: type || "info"
    });

    await newNotice.populate("postedBy", "name");

    // ✅ LOG ACTION
    await logAction({
      req,
      action: "NOTICE_CREATED",
      target: `Notice: ${title}`,
      details: { type: type || "info" }
    });

    res.status(201).json({ success: true, data: newNotice });
  } catch (err) {
    console.error("Create Notice Error:", err);
    res.status(500).json({ message: "Failed to post notice" });
  }
};

// Delete a notice
exports.deleteNotice = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find first to verify ownership and get title for log
    const notice = await Notice.findOneAndDelete({ _id: id, club: req.user.clubId });
    
    if (!notice) return res.status(404).json({ message: "Notice not found" });

    // ✅ LOG ACTION
    await logAction({
      req,
      action: "NOTICE_DELETED",
      target: `Deleted Notice: ${notice.title}`,
      details: { postedBy: notice.postedBy }
    });

    res.json({ success: true, message: "Notice deleted" });
  } catch (err) {
    console.error("Delete Notice Error:", err);
    res.status(500).json({ message: "Failed to delete" });
  }
};
// @desc    Fetch Active Global Broadcasts
// @route   GET /api/v1/notices/global
exports.getPublicGlobalNotices = async (req, res) => {
  try {
    // Fetch notices where club is NULL and (expiresAt is future OR undefined)
    const notices = await Notice.find({
      club: null,
      $or: [{ expiresAt: { $gt: new Date() } }, { expiresAt: { $exists: false } }]
    }).sort({ createdAt: -1 });

    res.json({ success: true, data: notices });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};