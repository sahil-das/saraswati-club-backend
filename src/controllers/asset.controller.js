const Asset = require("../models/Asset");
const { logAction } = require("../utils/auditLogger");

// Get All Assets (Hides Deleted)
exports.getAssets = async (req, res) => {
  try {
    const assets = await Asset.find({ 
        club: req.user.clubId, 
        isDeleted: false // 👈 Filter out deleted
    }).sort({ name: 1 });
    
    res.json({ success: true, data: assets });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Add New Asset
exports.addAsset = async (req, res) => {
  try {
    const asset = await Asset.create({
      ...req.body,
      club: req.user.clubId
    });

    await logAction({ req, action: "ASSET_ADDED", target: asset.name });
    res.status(201).json({ success: true, data: asset });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update Asset
exports.updateAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const asset = await Asset.findOneAndUpdate(
      { _id: id, club: req.user.clubId },
      req.body,
      { new: true }
    );

    if (!asset) return res.status(404).json({ message: "Asset not found" });

    // Log if location changed
    if (req.body.location) {
        await logAction({ 
            req, 
            action: "ASSET_MOVED", 
            target: `${asset.name} -> ${asset.location}` 
        });
    }

    res.json({ success: true, data: asset });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✅ Delete Asset (Soft Delete)
exports.deleteAsset = async (req, res) => {
  try {
    // Instead of findOneAndDelete, we update isDeleted: true
    const asset = await Asset.findOneAndUpdate(
        { _id: req.params.id, club: req.user.clubId },
        { isDeleted: true },
        { new: true }
    );

    if (!asset) return res.status(404).json({ message: "Asset not found" });

    await logAction({ req, action: "ASSET_REMOVED", target: asset.name });
    
    res.json({ success: true, message: "Asset moved to archives" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};