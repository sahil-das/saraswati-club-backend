const express = require("express");
const router = express.Router();
const controller = require("../controllers/notice.controller");
const authMiddleware = require("../middleware/auth.middleware");
const adminMiddleware = require("../middleware/admin.middleware");
const { getPublicGlobalNotices } = require("../controllers/notice.controller");

// 🔒 This line protects ALL routes below it
router.use(authMiddleware);

router.get("/", controller.getNotices);
router.post("/", adminMiddleware, controller.createNotice);
router.delete("/:id", adminMiddleware, controller.deleteNotice);

// ✅ FIX: Removed undefined 'protect'. It's already protected by 'router.use' above.
router.get("/global", getPublicGlobalNotices); 

module.exports = router;