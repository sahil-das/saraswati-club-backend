const express = require("express");
const router = express.Router();
const controller = require("../controllers/festivalYear.controller");
const authMiddleware = require("../middleware/auth.middleware");
const validate = require("../middleware/validate"); // 👈
const { createYearSchema } = require("../utils/schemas"); // 👈

router.use(authMiddleware);

// ✅ Add Validation
router.post("/", validate(createYearSchema), controller.createYear);

router.get("/", controller.getAllYears);
router.get("/active", controller.getActiveYear);
router.put("/:id", controller.updateYear);
router.post("/:id/close", controller.closeYear);

module.exports = router;