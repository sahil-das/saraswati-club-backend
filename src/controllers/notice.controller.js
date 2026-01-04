const Notice = require("../models/Notice");

// Get all notices for the active club
exports.getNotices = async (req, res) => {
  try {
    const { clubId } = req.user;
    // Sort by newest first
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

    const newNotice = await Notice.create({
      club: clubId,
      postedBy: userId,
      title,
      message,
      type: type || "info"
    });

    // Populate user name immediately for the frontend return
    await newNotice.populate("postedBy", "name");

    res.status(201).json({ success: true, data: newNotice });
  } catch (err) {
    res.status(500).json({ message: "Failed to post notice" });
  }
};

// Delete a notice
exports.deleteNotice = async (req, res) => {
  try {
    const { id } = req.params;
    await Notice.findByIdAndDelete(id);
    res.json({ success: true, message: "Notice deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete" });
  }
};