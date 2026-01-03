const express = require('express');
const router = express.Router();
const controller = require('../controllers/expense.controller');
const authMiddleware = require('../middleware/auth.middleware');
// We don't necessarily need checkYearOpen for GET requests, 
// but we definitely need it for adding expenses.
const checkYearOpen = require('../middleware/checkYearOpen');

// 1. Secure all routes
router.use(authMiddleware);

// 2. READ expenses (Uses the new .getExpenses function)
router.get('/', controller.getExpenses);

// 3. CREATE expense (Uses the new .addExpense function)
// We add 'checkYearOpen' to ensure they can't add expenses to a closed year
router.post('/', checkYearOpen, controller.addExpense);
router.put("/:id/status", authMiddleware, controller.updateStatus);
// 4. DELETE expense
router.delete('/:id', checkYearOpen, controller.deleteExpense);

module.exports = router;