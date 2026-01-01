const router = require("express").Router();
const cycleController = require("../controllers/cycle.controller");
const auth = require("../middleware/auth.middleware");
const admin = require("../middleware/admin.middleware");

router.post("/", auth, admin, cycleController.create);
router.get("/active", auth, cycleController.getActive);
router.get("/", auth, admin, cycleController.list);
router.post(
  "/:id/close",
  auth,
  admin,
  cycleController.closeCycle
);

/* 🔥 ADD THIS */
router.get("/years", auth, cycleController.getYears);

module.exports = router;
