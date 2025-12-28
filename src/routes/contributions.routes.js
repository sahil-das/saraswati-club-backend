const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth.middleware");
const checkYearOpen = require("../middleware/checkYearOpen");

const weeklyCtrl = require("../controllers/weeklyContribution.controller");
const pujaCtrl = require("../controllers/pujaContribution.controller");

router.use(auth);

/* ================= WEEKLY ================= */

// GET weekly contributions
router.get("/weekly", weeklyCtrl.list);

// ADD weekly contribution
router.post("/weekly", checkYearOpen, weeklyCtrl.create);

/* ================= PUJA ================= */

// GET puja contributions
router.get("/puja", pujaCtrl.list);

// ADD puja contribution
router.post("/puja", checkYearOpen, pujaCtrl.create);

module.exports = router;
