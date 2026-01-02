const express = require("express");
const router = express.Router();
const controller = require("../controllers/auth.controller");
const auth = require("../middleware/auth.middleware"); // Ensure you have this

// Existing Routes
//router.post("/register", controller.register);
router.post("/login", controller.login);
router.get("/me", auth, controller.getMe); // If you have a 'getMe' to fetch user data

// ✅ NEW PROFILE ROUTES
router.put("/profile", auth, controller.updateProfile);
router.put('/change-password', auth, controller.changePassword);

module.exports = router;