const express = require("express");
const router = express.Router();
const controller = require("../controllers/membership.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Protect all routes
router.use(authMiddleware);

router.get("/", controller.getAllMembers);
router.post("/", controller.addMember);
router.delete("/:id", controller.removeMember);

module.exports = router;