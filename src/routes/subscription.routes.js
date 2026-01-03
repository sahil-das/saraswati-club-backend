const express = require("express");
const router = express.Router();
const controller = require("../controllers/subscription.controller");
const authMiddleware = require("../middleware/auth.middleware");

router.use(authMiddleware);

// Get a member's card (Auto-creates if missing)
router.get("/member/:memberId", controller.getMemberSubscription);

// Pay a week/month
router.post("/pay", controller.payInstallment);

module.exports = router;