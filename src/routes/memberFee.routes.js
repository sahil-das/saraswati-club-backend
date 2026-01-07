const express = require("express");
const router = express.Router();
const controller = require("../controllers/memberFee.controller");
const authMiddleware = require("../middleware/auth.middleware");
const validate = require("../middleware/validate"); // 👈 Import
const { createMemberFeeSchema } = require("../utils/schemas"); // 👈 Import

router.use(authMiddleware);

// ✅ Add Validation
router.post("/", validate(createMemberFeeSchema), controller.createPayment);

router.get("/", controller.getAllFees);
router.get("/summary", controller.getFeeSummary);
router.delete("/:id", controller.deletePayment);
router.get("/member/:userId", controller.getMemberFees);

module.exports = router;