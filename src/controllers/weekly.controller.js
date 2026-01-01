const WeeklyPayment = require("../models/WeeklyPayment");
const PujaCycle = require("../models/PujaCycle");

/* ================= GET MEMBER WEEKLY STATUS ================= */
exports.getMemberWeeklyStatus = async (req, res) => {
  try {
    const { memberId } = req.params;

    // 1. Fetch Active Cycle
    const cycle = await PujaCycle.findOne({ isActive: true }).lean();
    if (!cycle) {
      return res.status(404).json({ message: "No active cycle" });
    }

    // 2. Find or Create Record
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

    // 3. Calculate Stats for this Member
    const paidWeeksCount = record.weeks.filter((w) => w.paid).length;
    const totalPaid = paidWeeksCount * (cycle.weeklyAmount || 0);
    const totalDue = ((cycle.totalWeeks || 52) * (cycle.weeklyAmount || 0)) - totalPaid;

    res.json({
      success: true,
      cycle: {
        id: cycle._id,
        name: cycle.name,
        weeklyAmount: cycle.weeklyAmount, // Send this to frontend
      },
      stats: {
        paidWeeks: paidWeeksCount,
        totalPaid,
        totalDue,
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

    if (!cycle || cycle.isClosed) {
      return res.status(403).json({ message: "Year is closed. No changes allowed." });
    }

    const record = await WeeklyPayment.findOne({ member: memberId, cycle: cycle._id });
    if (!record) return res.status(404).json({ message: "Record not found" });

    const week = record.weeks.find((w) => w.week === weekNumber);
    if (!week) return res.status(404).json({ message: "Week not found" });

    week.paid = true;
    week.paidAt = new Date();
    await record.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= UNDO PAID ================= */
exports.undoWeekPaid = async (req, res) => {
  try {
    const { memberId, weekNumber } = req.body;
    const cycle = await PujaCycle.findOne({ isActive: true });

    if (!cycle || cycle.isClosed) {
      return res.status(403).json({ message: "Year is closed. No changes allowed." });
    }

    const record = await WeeklyPayment.findOne({ member: memberId, cycle: cycle._id });
    if (!record) return res.status(404).json({ message: "Record not found" });

    const week = record.weeks.find((w) => w.week === weekNumber);
    if (!week) return res.status(404).json({ message: "Week not found" });

    week.paid = false;
    week.paidAt = null;
    await record.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};