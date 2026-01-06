const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Import Validation
const validate = require("../middleware/validate.middleware");
const { registerClubSchema, loginSchema } = require("../utils/schemas");

// Public Routes (Now Protected by Validation)
router.post("/register", validate(registerClubSchema), authController.registerClub);
router.post("/login", validate(loginSchema), authController.login);

// Protected Routes
router.get("/me", authMiddleware, authController.getMe);
router.put("/profile", authMiddleware, authController.updateProfile);
router.put("/change-password", authMiddleware, authController.changePassword);

module.exports = router;