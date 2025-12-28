const express = require('express');
const router = express.Router();
const fyCtrl = require('../controllers/financialYear.controller');
const auth = require('../middleware/auth.middleware');
const adminOnly = require('../middleware/admin.middleware');

router.use(auth);

// LIST years
router.get('/', fyCtrl.list);

// CLOSE YEAR (ADMIN ONLY)
router.post('/close', adminOnly, fyCtrl.closeYear);

module.exports = router;
