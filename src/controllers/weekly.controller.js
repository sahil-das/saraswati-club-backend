const WeeklyPayment = require("../models/WeeklyPayment");
const PujaCycle = require("../models/PujaCycle");

/* ================= GET MEMBER WEEKLY STATUS ================= */
exports.getMemberWeeklyStatus = async (req, res) => {
  try {
    const { memberId } = req.params;

    const cycle = await PujaCycle.findOne({ isActive: true }).lean();
    if (!cycle) {
      return res.status(404).json({ message: "No active cycle" });
    }

    let record = await WeeklyPayment.findOne({
      member: memberId,
      cycle: cycle._id,
    });

    if (!record) {
      record = await WeeklyPayment.create({
        member: memberId,
        cycle: cycle._id,
        weeks: Array.from(
          { length: cycle.totalWeeks || 52 },
          (_, i) => ({
            week: i + 1,
            paid: false,
            paidAt: null,
          })
        ),
      });
    }

    res.json({
      success: true,
      cycle: {
        id: cycle._id,               // ✅ IMPORTANT
        name: cycle.name,
        startDate: cycle.startDate,
        endDate: cycle.endDate,
      },
      weeks: record.weeks,
    });
  } catch (err) {
    console.error("weekly status error", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= MARK PAID ================= */
exports.markWeekPaid = async (req, res) => {
  try {
    const { memberId, weekNumber } = req.body;

    const cycle = await PujaCycle.findOne({ isActive: true });
    console.log("Active cycle:", cycle);
    if (cycle.isClosed) {
      return res.status(403).json({ message: "Year is closed. No changes allowed." });
    }

    const record = await WeeklyPayment.findOne({
      member: memberId,
      cycle: cycle._id,
    });

    if (!record) {
      return res.status(404).json({ message: "Weekly record not found" });
    }

    const week = record.weeks.find((w) => w.week === weekNumber);
    if (!week) {
      return res.status(404).json({ message: "Week not found" });
    }

    week.paid = true;
    week.paidAt = new Date();

    await record.save();

    res.json({ success: true });
  } catch (err) {
    console.error("mark paid error", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= UNDO PAID ================= */
exports.undoWeekPaid = async (req, res) => {
  try {
    const { memberId, weekNumber } = req.body;

    const cycle = await PujaCycle.findOne({ isActive: true });
    if (!cycle || cycle.isClosed) {
      return res.status(404).json({ message: "Year is closed. No changes allowed." });
    }

    const record = await WeeklyPayment.findOne({
      member: memberId,
      cycle: cycle._id,
    });

    if (!record) {
      return res.status(404).json({ message: "Weekly record not found" });
    }

    const week = record.weeks.find((w) => w.week === weekNumber);
    if (!week) {
      return res.status(404).json({ message: "Week not found" });
    }

    week.paid = false;
    week.paidAt = null;

    await record.save();

    res.json({ success: true });
  } catch (err) {
    console.error("undo paid error", err);
    res.status(500).json({ message: "Server error" });
  }
};
