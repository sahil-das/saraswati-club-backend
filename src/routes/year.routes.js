const express = require("express");
const router = express.Router();
const yearCtrl = require("../controllers/year.controller");
const auth = require("../middleware/auth.middleware");
const adminOnly = require("../middleware/admin.middleware");

router.use(auth);

router.get("/", adminOnly, yearCtrl.getYears);
router.post("/close", adminOnly, yearCtrl.closeYear);

module.exports = router;
