const express = require("express");
const router = express.Router();
const controller = require("../controllers/audit.controller");
const authMiddleware = require("../middleware/auth.middleware");
const adminMiddleware = require("../middleware/admin.middleware"); // ✅ STRICT ADMIN CHECK

router.use(authMiddleware);
router.use(adminMiddleware); // Apply to all routes below

router.get("/", controller.getLogs);

module.exports = router;