const express = require('express');
const router = express.Router();
const pujaCtrl = require('../controllers/puja.controller');
const auth = require('../middleware/auth.middleware');
const checkYearOpen = require('../middleware/checkYearOpen');

router.use(auth);

// READ puja contributions
router.get('/', pujaCtrl.list);

// ADD or UPDATE puja contribution (ADMIN)
router.post('/', checkYearOpen, pujaCtrl.createOrUpdate);

module.exports = router;
