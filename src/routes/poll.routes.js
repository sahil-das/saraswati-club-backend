const express = require("express");
const protect = require("../middleware/auth.middleware"); // 👈 FIX: No {}
const { restrictTo } = require("../middleware/role.middleware"); // 👈 FIX: Use new file
const { createPoll, castVote, getPollResults,getAllPolls,deletePoll } = require("../controllers/poll.controller");

const router = express.Router();

router.use(protect);

// Create Poll (Admin Only)
router.post("/", restrictTo("admin"), createPoll);

// Vote (Any Member)
router.post("/vote", castVote);

// View Results (Any Member)
router.get("/:pollId", getPollResults);
// ✅ NEW: List all polls
router.get("/", getAllPolls);
router.delete("/:pollId", restrictTo("admin"), deletePoll);
module.exports = router;