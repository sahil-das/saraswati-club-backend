const express = require("express");
const router = express.Router();
const controller = require("../controllers/subscription.controller");
const authMiddleware = require("../middleware/auth.middleware");
const idempotencyMiddleware = require("../middleware/idempotency.middleware"); // 👈 Import

router.use(authMiddleware);

router.get("/payments", controller.getAllPayments);
// Get a member's card (Auto-creates if missing)
router.get("/member/:memberId", controller.getMemberSubscription);

// ✅ FIX: Apply Idempotency to Payment Route
router.post("/pay", idempotencyMiddleware, controller.payInstallment);

module.exports = router;