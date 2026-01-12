const User = require("../models/User");
const Club = require("../models/Club");
const AuditLog = require("../models/AuditLog");
const mongoose = require("mongoose");
const { logAction } = require("../utils/auditLogger");
const os = require("os");
const jwt = require("jsonwebtoken");
const Notice = require("../models/Notice");
const crypto = require("crypto");
const RefreshToken = require("../models/RefreshToken");
const Membership = require("../models/Membership");
// @desc    Get Global Dashboard Stats & System Health
// @route   GET /api/v1/platform/stats
exports.getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalClubs = await Club.countDocuments();
    const activeClubs = await Club.countDocuments({ isActive: true });
    
    // Traffic: Count ALL audit logs in the last 24 hours (Global Activity)
    const last24h = new Date(new Date() - 24 * 60 * 60 * 1000);
    const traffic24h = await AuditLog.countDocuments({ createdAt: { $gte: last24h } });

    // System Health Check
    const dbStatus = mongoose.connection.readyState === 1 ? "UP" : "DOWN";

    res.json({
      success: true,
      data: {
        users: totalUsers,
        clubs: {
            total: totalClubs,
            active: activeClubs,
            inactive: totalClubs - activeClubs
        },
        traffic: traffic24h,
        systemHealth: {
            status: dbStatus,
            timestamp: new Date()
        }
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get All Clubs
// @route   GET /api/v1/platform/clubs
exports.getAllClubs = async (req, res) => {
  try {
    const clubs = await Club.find()
      .populate("owner", "name email phone")
      .select("name code isActive createdAt address contactPhone")
      .sort({ createdAt: -1 });

    res.json({ success: true, count: clubs.length, data: clubs });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Toggle Club Status (Suspend/Activate)
// @route   PATCH /api/v1/platform/clubs/:id/toggle
exports.toggleClubStatus = async (req, res) => {
  try {
    const club = await Club.findById(req.params.id);
    if (!club) return res.status(404).json({ message: "Club not found" });

    // Toggle
    club.isActive = !club.isActive;
    await club.save();

    // Log this Platform Action using our updated utility
    await logAction({
        req,
        action: club.isActive ? "CLUB_ACTIVATED" : "CLUB_SUSPENDED",
        target: club.name,
        details: { clubId: club._id, newStatus: club.isActive }
    });

    res.json({ 
        success: true, 
        message: `Club ${club.isActive ? 'Activated' : 'Suspended'}`, 
        data: club 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get System-Wide Audit Logs (Reports)
// @route   GET /api/v1/platform/logs
exports.getSystemLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, type, startDate, endDate } = req.query;

    const query = {};

    // 1. Filter by Search (Target or Details)
    if (search) {
      query.$or = [
        { target: { $regex: search, $options: "i" } },
        { action: { $regex: search, $options: "i" } }
      ];
    }

    // 2. Filter by Action Type
    if (type && type !== "ALL") {
      query.action = type;
    }

    // 3. Filter by Date Range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const logs = await AuditLog.find(query)
      .populate("actor", "name email isPlatformAdmin") // Show who did it
      .populate("club", "name code") // Show which club it affected (if any)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await AuditLog.countDocuments(query);

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get Detailed System Health Metrics
// @route   GET /api/v1/platform/health-metrics
exports.getSystemHealth = async (req, res) => {
  try {
    // 1. Calculate Uptime
    const uptimeSeconds = process.uptime();
    const days = Math.floor(uptimeSeconds / (3600 * 24));
    const hours = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);

    // 2. Memory Usage
    const memory = process.memoryUsage();
    const freeMem = os.freemem();
    const totalMem = os.totalmem();
    const memUsagePercent = ((totalMem - freeMem) / totalMem) * 100;

    // 3. Database Check (Measure Latency)
    const startDb = Date.now();
    await mongoose.connection.db.admin().ping();
    const dbLatency = Date.now() - startDb;

    res.json({
      success: true,
      data: {
        uptime: {
            text: `${days}d ${hours}h ${minutes}m`,
            seconds: uptimeSeconds
        },
        server: {
            nodeVersion: process.version,
            platform: process.platform,
            cpuArch: process.arch,
            cpuCores: os.cpus().length,
        },
        memory: {
            rss: (memory.rss / 1024 / 1024).toFixed(2) + " MB", // Resident Set Size
            heapTotal: (memory.heapTotal / 1024 / 1024).toFixed(2) + " MB",
            heapUsed: (memory.heapUsed / 1024 / 1024).toFixed(2) + " MB",
            systemFree: (freeMem / 1024 / 1024 / 1024).toFixed(2) + " GB",
            systemTotal: (totalMem / 1024 / 1024 / 1024).toFixed(2) + " GB",
            percent: memUsagePercent.toFixed(1)
        },
        database: {
            status: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
            latency: dbLatency + "ms",
            host: mongoose.connection.host,
            name: mongoose.connection.name
        },
        timestamp: new Date()
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Impersonate a Club Admin (Ghost Mode)
// @route   POST /api/v1/platform/impersonate/:userId
exports.impersonateUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const targetUser = await User.findById(userId);
    if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
    }

    if (targetUser.isPlatformAdmin) {
        return res.status(403).json({ message: "Cannot impersonate another Platform Admin." });
    }

    // Generate Tokens
    const accessToken = jwt.sign(
        { id: targetUser._id }, 
        process.env.JWT_SECRET, 
        { expiresIn: "15m" }
    );

    // ✅ FIX: Use consistent variable name
    const refreshToken = crypto.randomBytes(40).toString("hex"); // Renamed from refreshTokenString
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); 

    await RefreshToken.create({
        user: targetUser._id,
        token: refreshToken, // matches variable above
        expiresAt,
        createdByIp: req.ip
    });

    const memberships = await Membership.find({ user: targetUser._id, status: "active" })
        .populate("club", "name code");

    res.json({
        success: true,
        accessToken,
        refreshToken, // ✅ NOW VALID (matches the variable name)
        user: {
            id: targetUser._id,
            name: targetUser.name,
            email: targetUser.email,
            isPlatformAdmin: targetUser.isPlatformAdmin
        },
        clubs: memberships.map(m => ({
            clubId: m.club._id,
            clubName: m.club.name,
            clubCode: m.club.code,
            role: m.role
        }))
    });

  } catch (error) {
    console.error("Impersonation Error:", error); // Helpful for debugging
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a Global Broadcast
// @route   POST /api/v1/platform/announcements
exports.createGlobalNotice = async (req, res) => {
  try {
    const { title, message, type, daysDuration } = req.body;

    // Default duration: 3 days if not specified
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (daysDuration || 3));

    const notice = await Notice.create({
      club: null, // 👈 NULL means Global
      title,
      message,
      type,
      expiresAt,
      postedBy: req.user._id
    });

    res.status(201).json({ success: true, data: notice });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get All Global Broadcasts (For Admin Management)
// @route   GET /api/v1/platform/announcements
exports.getGlobalNotices = async (req, res) => {
  try {
    const notices = await Notice.find({ club: null })
      .sort({ createdAt: -1 })
      .populate("postedBy", "name");

    res.json({ success: true, data: notices });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a Broadcast
// @route   DELETE /api/v1/platform/announcements/:id
exports.deleteGlobalNotice = async (req, res) => {
  try {
    await Notice.findOneAndDelete({ _id: req.params.id, club: null });
    res.json({ success: true, message: "Announcement removed" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};