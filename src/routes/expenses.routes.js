const express = require('express');
const router = express.Router();
const controller = require('../controllers/expense.controller');
const authMiddleware = require('../middleware/auth.middleware');
const checkYearOpen = require('../middleware/checkYearOpen');

// Import Validation
const validate = require("../middleware/validate.middleware");
const { createExpenseSchema } = require("../utils/schemas");

// 1. Secure all routes
router.use(authMiddleware);

// 2. READ expenses 
router.get('/', controller.getExpenses);

// 3. CREATE expense (Now Validated)
router.post('/', checkYearOpen, validate(createExpenseSchema), controller.addExpense);

router.put("/:id/status", authMiddleware, controller.updateStatus);

// 4. DELETE expense
router.delete('/:id', checkYearOpen, controller.deleteExpense);

module.exports = router;