// src/routes/history.routes.js
const router = require("express").Router();
const auth = require("../middleware/auth.middleware");
const admin = require("../middleware/admin.middleware");
const ctrl = require("../controllers/history.controller");
const cycleCtrl = require("../controllers/cycle.controller"); // Import Cycle Controller

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
// We map this to the cycle controller's logic
// Note: This attempts to close the *Active* cycle. 
// If the user tries to close an old cycle, the controller will reject it or just close the active one.
router.post("/cycle/:cycleId/close", admin, cycleCtrl.closeActiveCycle);

module.exports = router;