const express = require("express");
const router = express.Router();
const controller = require("../controllers/subscription.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Secure all routes
router.use(authMiddleware);

// Admin Routes
router.get("/", controller.getAllSubscriptions); // List everyone
router.put("/:subscriptionId/installments", controller.updateInstallmentStatus); // Mark paid

// Member Routes
router.get("/me", controller.getMySubscription); // View my own card

module.exports = router;