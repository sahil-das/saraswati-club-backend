const express = require("express");
const router = express.Router();
const controller = require("../controllers/cycle.controller");

// Correct Imports based on your project structure
const auth = require("../middleware/auth.middleware"); 
const admin = require("../middleware/admin.middleware");

// Public/Member Routes
router.get("/active", auth, controller.getActive);
router.get("/list", auth, controller.list);

// Admin Routes
router.post("/create", auth, admin, controller.create);

// Important: Ensure your controller has 'closeActiveCycle' (from Step 2)
// If you haven't updated the controller yet, this line might also fail.
router.post("/close", auth, admin, controller.closeActiveCycle); 

module.exports = router;