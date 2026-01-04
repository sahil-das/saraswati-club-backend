const express = require("express");
const router = express.Router();
const controller = require("../controllers/memberFee.controller");
const authMiddleware = require("../middleware/auth.middleware");

router.use(authMiddleware);

// Record Payment
router.post("/", controller.createPayment);

// Get List (Logs)
router.get("/", controller.getAllFees);

// ✅ NEW: Get Collection Matrix (Members + Paid Status)
router.get("/summary", controller.getFeeSummary);

// Delete
router.delete("/:id", controller.deletePayment);

// Get Member-specific Fees
router.get("/member/:userId", controller.getMemberFees);

module.exports = router;