// src/routes/membership.routes.js
const express = require("express");
const router = express.Router();
const controller = require("../controllers/membership.controller");
const authMiddleware = require("../middleware/auth.middleware");

router.use(authMiddleware);

// ✅ ADD THIS NEW ROUTE HERE:
router.get("/my-stats", controller.getMyStats); 

router.get("/", controller.getAllMembers);
router.post("/", controller.addMember);
router.delete("/:id", controller.removeMember);
router.put("/:id/role", controller.updateRole);

module.exports = router;