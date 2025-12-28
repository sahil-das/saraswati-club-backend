const express = require('express');
const router = express.Router();
const weeklyCtrl = require('../controllers/weekly.controller');
const auth = require('../middleware/auth.middleware');
const checkYearOpen = require('../middleware/checkYearOpen');

router.use(auth);

// READ weekly contributions
router.get('/', weeklyCtrl.list);

// ADD weekly contribution
router.post('/', checkYearOpen, weeklyCtrl.create);

// UNDO / UPDATE weekly contribution
router.put('/:id', checkYearOpen, weeklyCtrl.update);

module.exports = router;
