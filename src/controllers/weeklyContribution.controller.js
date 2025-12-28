const WeeklyContribution = require("../models/WeeklyContribution");

exports.list = async (req, res) => {
  try {
    const { year } = req.query;

    const data = await WeeklyContribution.find({ year })
      .populate("member", "email")
      .sort({ weekNumber: 1 });

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.create = async (req, res) => {
  const { memberId, amount, weekNumber, year } = req.body;

  await WeeklyContribution.create({
    member: memberId,
    amount,
    weekNumber,
    year,
    paidAt: new Date(),
  });

  res.json({ success: true });
};
