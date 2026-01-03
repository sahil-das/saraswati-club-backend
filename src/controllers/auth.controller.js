// src/controllers/auth.controller.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Club = require("../models/Club");
const Membership = require("../models/Membership");

/**
 * REGISTER NEW FESTIVAL COMMITTEE (SaaS Onboarding)
 */
exports.registerClub = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { 
      clubName, 
      clubCode, 
      contributionFrequency, // "weekly", "monthly", or "none"
      adminName, 
      email, 
      password, 
      phone 
    } = req.body;

    // 1. Validate Input
    if (!clubName || !clubCode || !email || !password) {
      throw new Error("Please provide Club Name, Club Code, Email, and Password.");
    }

    // 2. Check Uniqueness
    const existingClub = await Club.findOne({ code: clubCode });
    if (existingClub) throw new Error("Club Code is already taken. Please choose another.");

    const existingUser = await User.findOne({ email });
    if (existingUser) throw new Error("Email is already registered. Please login to create another club.");

    // 3. Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 4. Create USER (Global Identity)
    const newUser = await User.create([{
      name: adminName,
      email,
      password: hashedPassword,
      phone,
      isPlatformAdmin: false
    }], { session });

    // 5. Create CLUB (The Organization)
    const newClub = await Club.create([{
      name: clubName,
      code: clubCode,
      owner: newUser[0]._id,
      settings: {
        contributionFrequency: contributionFrequency || "weekly",
        defaultInstallmentCount: contributionFrequency === "monthly" ? 12 : 52
      }
    }], { session });

    // 6. Create MEMBERSHIP (The Admin Link)
    await Membership.create([{
      user: newUser[0]._id,
      club: newClub[0]._id,
      role: "admin",
      status: "active"
    }], { session });

    await session.commitTransaction();
    session.endSession();

    // 7. Generate Token
    const token = jwt.sign({ id: newUser[0]._id }, process.env.JWT_SECRET, { expiresIn: "1d" });

    res.status(201).json({
      success: true,
      message: "Club registered successfully!",
      token,
      user: { id: newUser[0]._id, name: newUser[0].name, email: newUser[0].email },
      club: { id: newClub[0]._id, name: newClub[0].name, code: newClub[0].code }
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("Registration Error:", err);
    res.status(400).json({ message: err.message || "Registration failed" });
  }
};

/**
 * LOGIN (Multi-Club Aware)
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Authenticate User
    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // 2. Fetch Memberships (Which clubs do they belong to?)
    const memberships = await Membership.find({ user: user._id, status: "active" })
      .populate("club", "name code settings");

    if (memberships.length === 0) {
      return res.status(403).json({ message: "You have an account, but you are not a member of any club." });
    }

    // 3. Generate Token (User ID only)
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" });

    res.json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email },
      // Frontend will use this list to show a "Select Club" screen
      clubs: memberships.map(m => ({
        clubId: m.club._id,
        clubName: m.club.name,
        clubCode: m.club.code,
        role: m.role,
        frequency: m.club.settings.contributionFrequency
      }))
    });

  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET CURRENT USER (And their Clubs)
 */
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const memberships = await Membership.find({ user: user._id, status: "active" })
      .populate("club", "name code settings");

    res.json({
      success: true,
      user,
      clubs: memberships.map(m => ({
        clubId: m.club._id,
        clubName: m.club.name,
        clubCode: m.club.code,
        role: m.role
      }))
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};