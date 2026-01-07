const express = require("express");
const router = express.Router();
const controller = require("../controllers/donation.controller");
const authMiddleware = require("../middleware/auth.middleware");
const validate = require('../middleware/validate'); 
const { createDonationSchema } = require('../utils/schemas');

router.use(authMiddleware);

// ✅ Apply Validation
router.post("/", validate(createDonationSchema), controller.addDonation);
router.get("/", controller.getDonations);
router.delete("/:id", controller.deleteDonation);

module.exports = router;