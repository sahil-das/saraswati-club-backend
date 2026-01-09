const express = require("express");
const router = express.Router();
const { 
  registerClub, 
  login, 
  refreshToken, 
  revokeToken, 
  getMe, 
  updateProfile, 
  changePassword 
} = require("../controllers/auth.controller");
const protect = require("../middleware/auth.middleware");
const validate = require("../middleware/validate"); // 👈 Import
const schemas = require("../utils/schemas"); // 👈 Import schemas

// Apply middleware to routes
router.post("/register", validate(schemas.registerClubSchema), registerClub);
router.post("/login", validate(schemas.loginSchema), login);
router.post("/refresh-token", refreshToken); // 🆕

// Protected
router.post("/revoke-token", protect, revokeToken); // 🆕
router.get("/me", protect, getMe);
router.put("/profile", protect, updateProfile);
router.put("/update-password", protect, changePassword);

module.exports = router;