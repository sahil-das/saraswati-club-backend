const express = require("express");
const router = express.Router();
const controller = require("../controllers/archive.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Protect all archive routes
router.use(authMiddleware);

// Get list of all past years
router.get("/", controller.getArchivedYears);

// Get deep dive details for a specific year
router.get("/:yearId", controller.getArchiveDetails);

module.exports = router;