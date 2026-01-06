const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Validation Imports
const validate = require("../middleware/validate.middleware");
const { registerClubSchema, loginSchema } = require("../utils/schemas");

// 👇 Import the strict limiter here
const { authLimiter } = require("../middleware/limiters");

// Public Routes (Protected by Strict Rate Limit + Validation)
router.post("/register", authLimiter, validate(registerClubSchema), authController.registerClub);
router.post("/login", authLimiter, validate(loginSchema), authController.login);

// Protected Routes (Normal Access - NO Strict Limit)
// This fixes the issue where reloading the dashboard blocked the user
router.get("/me", authMiddleware, authController.getMe);
router.put("/profile", authMiddleware, authController.updateProfile);
router.put("/change-password", authMiddleware, authController.changePassword);

module.exports = router;