const express = require('express');
const router = express.Router();
const donationCtrl = require('../controllers/donation.controller');
const auth = require('../middleware/auth.middleware');
const checkYearOpen = require('../middleware/checkYearOpen');

// All routes require authentication
router.use(auth);

// READ donations (allowed even for closed years)
router.get('/', donationCtrl.list);

// CREATE donation (BLOCKED if year is closed)
router.post('/', checkYearOpen, donationCtrl.create);

module.exports = router;
