const express = require("express");
const router = express.Router();
const controller = require("../controllers/finance.controller");
const authMiddleware = require("../middleware/auth.middleware");

router.use(authMiddleware);

// The Dashboard calls this to show the "Big Numbers"
router.get("/summary", controller.getSummary);

module.exports = router;