// src/routes/auth.routes.js
const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Public Routes
router.post("/register", authController.registerClub); // 👈 NEW
router.post("/login", authController.login);

// Protected Routes
router.get("/me", authMiddleware, authController.getMe);
router.put("/profile", authMiddleware, authController.updateProfile);
router.put("/change-password", authMiddleware, authController.changePassword);
module.exports = router;