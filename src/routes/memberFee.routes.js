const express = require("express");
const router = express.Router();
const controller = require("../controllers/memberFee.controller");
const authMiddleware = require("../middleware/auth.middleware");

router.use(authMiddleware);

router.post("/", controller.createPayment);
router.get("/", controller.getAllFees);
router.delete("/:id", controller.deletePayment);

module.exports = router;