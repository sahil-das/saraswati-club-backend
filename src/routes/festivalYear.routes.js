const express = require("express");
const router = express.Router();
const controller = require("../controllers/festivalYear.controller");
const authMiddleware = require("../middleware/auth.middleware");

// All routes require login
router.use(authMiddleware);

router.post("/", controller.createYear);        // Create new cycle
router.get("/", controller.getAllYears);        // List history
router.get("/active", controller.getActiveYear);// Get current context

module.exports = router;