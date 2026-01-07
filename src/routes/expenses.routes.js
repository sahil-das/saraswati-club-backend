const express = require('express');
const router = express.Router();
const controller = require('../controllers/expense.controller');
const authMiddleware = require('../middleware/auth.middleware');
const checkYearOpen = require('../middleware/checkYearOpen');
const validate = require('../middleware/validate'); // 👈 Import
const { createExpenseSchema } = require('../utils/schemas'); // 👈 Import

router.use(authMiddleware);

router.get('/', controller.getExpenses);

// ✅ Validate Body -> Check Year Open -> Controller
router.post('/', 
  validate(createExpenseSchema), 
  checkYearOpen, 
  controller.addExpense
);

router.put("/:id/status", authMiddleware, controller.updateStatus);
router.delete('/:id', checkYearOpen, controller.deleteExpense);

module.exports = router;