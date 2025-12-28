const express = require('express');
const router = express.Router();
const expenseCtrl = require('../controllers/expense.controller');
const auth = require('../middleware/auth.middleware');
const checkYearOpen = require('../middleware/checkYearOpen');

router.use(auth);

// READ expenses (all years)
router.get('/', expenseCtrl.list);

// CREATE expense (blocked if year closed)
router.post('/', checkYearOpen, expenseCtrl.create);

// APPROVE expense (ADMIN, blocked if year closed)
router.put('/:id/approve', checkYearOpen, expenseCtrl.approve);

// REJECT expense (ADMIN, blocked if year closed)
router.put('/:id/reject', checkYearOpen, expenseCtrl.reject);

module.exports = router;
