const User = require("../models/User");
const bcrypt = require("bcryptjs");
const PujaCycle = require("../models/PujaCycle");
const WeeklyPayment = require("../models/WeeklyPayment");
const PujaContribution = require("../models/PujaContribution");
/**
 * GET all members (admin only)
 */
exports.list = async (req, res) => {
  const members = await User.find({ role: "member" }).select("-password");
  res.json({
    success: true,
    data: members,
  });
};

/**
 * CREATE member (admin only)
 */
exports.create = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    /* ================= VALIDATION ================= */
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    // ✅ Force domain
    if (!email.endsWith("@clubname.com")) {
      return res.status(400).json({
        message: "Email must be @clubname.com",
      });
    }

    // ✅ Unique email
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    /* ================= PASSWORD ================= */
    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    const hashed = await bcrypt.hash(password, 10);

    /* ================= CREATE ================= */
    const member = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashed,
      role: "member", // 🔒 forced
    });

    res.status(201).json({
      success: true,
      message: "Member created successfully",
      data: {
        id: member._id,
        name: member.name,
        email: member.email,
      },
    });
  } catch (err) {
    console.error("Member create error:", err);
    res.status(500).json({
      message: "Server error",
    });
  }
};

/**
 * GET member details
 */
exports.details = async (req, res) => {
  const user = await User.findById(req.params.id).select("-password");

  if (!user) {
    return res.status(404).json({
      message: "Member not found",
    });
  }

  res.json({
    success: true,
    data: user,
  });
};
/* ================= GET MY FINANCIAL STATS ================= */
exports.getMyStats = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Get Active Cycle
    const cycle = await PujaCycle.findOne({ isActive: true });
    if (!cycle) {
      return res.json({ 
        success: true, 
        data: { totalPaid: 0, totalDue: 0, history: [] } 
      });
    }

    // 2. Calculate Weekly Payments
    const weeklyRecord = await WeeklyPayment.findOne({ 
      member: userId, 
      cycle: cycle._id 
    });
    
    const paidWeeksCount = weeklyRecord 
      ? weeklyRecord.weeks.filter(w => w.paid).length 
      : 0;
      
    const weeklyTotal = paidWeeksCount * cycle.weeklyAmount;
    const weeklyDue = (cycle.totalWeeks - paidWeeksCount) * cycle.weeklyAmount;

    // 3. Calculate Puja Contributions
    const contributions = await PujaContribution.find({ 
      member: userId, 
      cycle: cycle._id 
    }).sort({ createdAt: -1 });

    const pujaTotal = contributions.reduce((sum, c) => sum + c.amount, 0);

    // 4. Combine into a "History" list
    // We mix weekly payments (dates) and puja contributions into one list
    let history = [];

    // Add paid weeks to history
    if (weeklyRecord) {
      weeklyRecord.weeks.forEach(w => {
        if (w.paid) {
          history.push({
            type: "Weekly",
            description: `Week ${w.week}`,
            amount: cycle.weeklyAmount,
            date: w.paidAt || cycle.startDate, // Fallback if paidAt missing
          });
        }
      });
    }

    // Add contributions to history
    contributions.forEach(c => {
      history.push({
        type: "Puja",
        description: "Extra Contribution",
        amount: c.amount,
        date: c.createdAt,
      });
    });

    // Sort by date (newest first)
    history.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      success: true,
      data: {
        cycleName: cycle.name,
        totalPaid: weeklyTotal + pujaTotal,
        totalDue: weeklyDue, // Only weekly implies a "due" amount
        history: history
      }
    });

  } catch (err) {
    console.error("My Stats Error:", err);
    res.status(500).json({ message: "Failed to load stats" });
  }
};