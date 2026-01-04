const express = require("express");
const router = express.Router();
const controller = require("../controllers/notice.controller");
const authMiddleware = require("../middleware/auth.middleware");
const adminMiddleware = require("../middleware/admin.middleware");

router.use(authMiddleware);

router.get("/", controller.getNotices);
router.post("/", adminMiddleware, controller.createNotice); // Only Admin can post
router.delete("/:id", adminMiddleware, controller.deleteNotice);

module.exports = router;