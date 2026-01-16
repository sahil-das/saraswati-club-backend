const express = require("express");
const protect = require("../middleware/auth.middleware");
const { restrictTo } = require("../middleware/role.middleware");
const { getAssets, addAsset, updateAsset, deleteAsset } = require("../controllers/asset.controller");

const router = express.Router();

router.use(protect);

router.get("/", getAssets);
router.post("/", restrictTo("admin"), addAsset);
router.put("/:id", restrictTo("admin"), updateAsset); // 👈 Updates location/quantity
router.delete("/:id", restrictTo("admin"), deleteAsset);

module.exports = router;