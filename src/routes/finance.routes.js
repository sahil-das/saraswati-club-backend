const router = require("express").Router();
const auth = require("../middleware/auth.middleware");
const financeController = require("../controllers/finance.controller");

router.get("/summary", auth, financeController.summary);
router.get("/weekly-total", auth, financeController.weeklyTotal);
router.get("/puja-total", auth, financeController.pujaTotal);
router.get("/donations-total", auth, financeController.donationTotal);
router.get("/expenses-total", auth, financeController.expenseTotal);
// optional
router.get("/central-fund", auth, financeController.centralFund);

module.exports = router;