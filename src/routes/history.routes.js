const router = require("express").Router();
const auth = require("../middleware/auth.middleware");
const admin = require("../middleware/admin.middleware");
const ctrl = require("../controllers/history.controller");

router.use(auth);

/* ===== LIST CYCLES ===== */
router.get("/cycles", admin, ctrl.listCycles);

/* ===== SUMMARY ===== */
router.get("/cycle/:cycleId/summary", admin, ctrl.cycleSummary);

/* ===== BREAKDOWNS ===== */
router.get("/cycle/:cycleId/weekly", admin, ctrl.weekly);
router.get("/cycle/:cycleId/puja", admin, ctrl.puja);
router.get("/cycle/:cycleId/donations", admin, ctrl.donations);
router.get("/cycle/:cycleId/expenses", admin, ctrl.expenses);

/* ===== CLOSE CYCLE ===== */
router.post("/cycle/:cycleId/close", admin, ctrl.closeCycle);

module.exports = router;
