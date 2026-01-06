const Joi = require("joi");

// Auth Schemas
exports.registerClubSchema = Joi.object({
  clubName: Joi.string().min(3).required(),
  clubCode: Joi.string().alphanum().min(3).required(), // Alphanumeric only prevents special char injection
  adminName: Joi.string().min(3).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  phone: Joi.string().pattern(/^[0-9]{10}$/).optional() // Example: strict 10 digit check
});

exports.loginSchema = Joi.object({
  email: Joi.string().required(), // We allow email or username, so generic string check
  password: Joi.string().required()
});

// Expense Schemas
exports.createExpenseSchema = Joi.object({
  title: Joi.string().min(3).required(),
  amount: Joi.number().positive().required(), // Prevents negative expenses
  category: Joi.string().required(),
  description: Joi.string().allow("").optional(),
  date: Joi.date().optional()
});

// Year Schema
exports.createYearSchema = Joi.object({
  name: Joi.string().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().greater(Joi.ref('startDate')).required(), // End date must be after start
  openingBalance: Joi.number().min(0).optional(),
  subscriptionFrequency: Joi.string().valid("weekly", "monthly", "none").required(),
  totalInstallments: Joi.number().min(1).optional(),
  amountPerInstallment: Joi.number().min(0).optional()
});