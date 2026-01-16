const Joi = require("joi");

// Auth Schemas
exports.registerClubSchema = Joi.object({
  clubName: Joi.string().min(3).required(),
  
  // ✅ FIX 1: Allow hyphens/underscores in clubCode
  clubCode: Joi.string()
    .pattern(/^[a-zA-Z0-9-_]+$/)
    .min(3)
    .max(20)
    .required()
    .messages({
      "string.pattern.base": "Club code can only contain letters, numbers, hyphens, and underscores."
    }),

  adminName: Joi.string().min(3).required(),

  // ✅ FIX 2: Add the missing 'username' field!
  username: Joi.string().alphanum().min(3).max(30).required(),

  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  phone: Joi.string().pattern(/^[0-9]{10}$/).optional()
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

// Add this to existing schemas
exports.createDonationSchema = Joi.object({
  donorName: Joi.string().min(3).required(),
  
  // ✅ NEW: Type support
  type: Joi.string().valid("cash", "online", "item").default("cash"),

  // ✅ CONDITIONAL: Amount is required ONLY if type is NOT 'item'
  amount: Joi.number().when('type', {
    is: 'item',
    then: Joi.optional(), // Can be 0 or missing for items
    otherwise: Joi.number().positive().required() // Required for cash/online
  }),

  // ✅ NEW: Validation for Item Details
  itemDetails: Joi.when('type', {
    is: 'item',
    then: Joi.object({
      itemName: Joi.string().required(),
      quantity: Joi.string().required(),
      estimatedValue: Joi.number().optional()
    }).required(),
    otherwise: Joi.optional()
  }),

  address: Joi.string().allow("").optional(),
  
  // ✅ FIX: .allow("") lets you send empty strings without error
  phone: Joi.string().allow("").pattern(/^[0-9]+$/).optional(),
  receiptNo: Joi.string().allow("").optional(),
  
  date: Joi.date().optional()
});

exports.createMemberFeeSchema = Joi.object({
  userId: Joi.string().required(), // ObjectId as string
  amount: Joi.number().positive().required(),
  notes: Joi.string().allow("").optional()
});

exports.createYearSchema = Joi.object({
  name: Joi.string().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().greater(Joi.ref('startDate')).required(),
  openingBalance: Joi.number().min(0).optional(),
  subscriptionFrequency: Joi.string().valid("weekly", "monthly", "none").required(),
  
  // ✅ ADDED LIMITS: 
  // .min(1) ensures at least one installment exists
  // .max(52) or .max(104) prevents massive array generation in the database
  totalInstallments: Joi.number().min(1).max(52).optional()
    .messages({
      'number.max': 'Weekly installments cannot exceed 52 (1 year).',
      'number.min': 'There must be at least 1 installment.'
    }),
    
  amountPerInstallment: Joi.number().min(0).optional()
});