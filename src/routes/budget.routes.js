const express = require("express");
const protect = require("../middleware/auth.middleware");
const { restrictTo } = require("../middleware/role.middleware");
const { getBudgetAnalysis, setBudget, deleteBudget } = require("../controllers/budget.controller");

const router = express.Router();

router.use(protect);

router.get("/", getBudgetAnalysis);
router.post("/", restrictTo("admin"), setBudget);

// ✅ NEW: Delete Route
router.delete("/:id", restrictTo("admin"), deleteBudget);

module.exports = router;