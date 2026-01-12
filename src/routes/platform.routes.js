const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth.middleware");
const platformAdmin = require("../middleware/platformAdmin.middleware");
const { 
    getDashboardStats, 
    getAllClubs, 
    toggleClubStatus, 
    getSystemLogs,
    impersonateUser,
    getSystemHealth,createGlobalNotice, getGlobalNotices, deleteGlobalNotice // 👈 Import new controller
} = require("../controllers/platform.controller");

// All routes require Login + PlatformAdmin role
router.use(protect, platformAdmin);

router.get("/stats", getDashboardStats);
router.get("/clubs", getAllClubs);
router.patch("/clubs/:id/toggle", toggleClubStatus);
router.get("/logs", getSystemLogs); // 👈 New Route
router.get("/health-metrics", getSystemHealth);
router.post("/impersonate/:userId", impersonateUser);
router.post("/announcements", createGlobalNotice);
router.get("/announcements", getGlobalNotices);
router.delete("/announcements/:id", deleteGlobalNotice);
module.exports = router;