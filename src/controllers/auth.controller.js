const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Club = require("../models/Club");
const Membership = require("../models/Membership");

/**
 * REGISTER NEW FESTIVAL COMMITTEE
 */
exports.registerClub = async (req, res) => {
  try {
    const { 
      clubName, 
      clubCode, 
      adminName, 
      email, 
      password, 
      phone 
    } = req.body;

    // 1. Validate Input
    if (!clubName || !clubCode || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // 2. Check Uniqueness
    const existingClub = await Club.findOne({ code: clubCode });
    if (existingClub) return res.status(400).json({ message: "Club Code is already taken." });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "Email is already registered." });

    // 3. Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 4. Create USER
    // Note: For the Club Admin, their 'email' acts as their System ID.
    const newUser = await User.create({
      name: adminName,
      email: email.toLowerCase(),
      password: hashedPassword,
      phone,
      isPlatformAdmin: false
    });

    // 5. Create CLUB
    const newClub = await Club.create({
      name: clubName,
      code: clubCode,
      owner: newUser._id,
      settings: {
        contributionFrequency: "weekly",
        defaultInstallmentCount: 52,
        defaultAmountPerInstallment: 0
      }
    });

    // 6. Create MEMBERSHIP
    await Membership.create({
      user: newUser._id,
      club: newClub._id,
      role: "admin",
      status: "active"
    });

    // 7. Generate Token
    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, { expiresIn: "30d" });

    res.status(201).json({
      success: true,
      message: "Club registered successfully!",
      token,
      user: { id: newUser._id, name: newUser.name, email: newUser.email },
      club: { id: newClub._id, name: newClub.name, code: newClub.code }
    });

  } catch (err) {
    console.error("Registration Error:", err);
    res.status(500).json({ message: "Registration failed", error: err.message });
  }
};

/**
 * LOGIN USER (Supports System ID OR Personal Email)
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body; // 'email' here is the input value (ID or Gmail)

    if (!email || !password) {
      return res.status(400).json({ message: "Please provide ID and password" });
    }

    // ✅ FIXED: Check BOTH fields using $or
    const user = await User.findOne({ 
      $or: [
        { email: email.toLowerCase() },          // System ID (rahul@club.com)
        { personalEmail: email.toLowerCase() }   // Personal Gmail (rahul@gmail.com)
      ] 
    }).select("+password");

    // 1. Check User Existence & Password
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // 2. Fetch Memberships (Which clubs do they belong to?)
    const memberships = await Membership.find({ user: user._id, status: "active" })
      .populate("club", "name code settings");

    if (memberships.length === 0) {
      return res.status(403).json({ message: "You are not a member of any club." });
    }

    // 3. Generate Token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "30d" });

    res.json({
      success: true,
      token,
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        phone: user.phone 
      },
      // Frontend uses this list to auto-select or show selection screen
      clubs: memberships.map(m => ({
        clubId: m.club._id,
        clubName: m.club.name,
        clubCode: m.club.code,
        role: m.role,
        frequency: m.club.settings?.contributionFrequency || "weekly"
      }))
    });

  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET CURRENT USER
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
        role: m.role,
        frequency: m.club.settings?.contributionFrequency || "weekly"
      }))
    });
  } catch (err) {
    console.error("GetMe Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * UPDATE PROFILE
 */
exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, email } = req.body;
    
    // Find and update
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, phone, email },
      { new: true, runValidators: true }
    ).select("-password");

    res.json({
      success: true,
      data: user, // 🛑 Frontend expects { data: user } structure
      message: "Profile updated successfully"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

/**
 * CHANGE PASSWORD
 */
exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "Please provide both old and new passwords." });
    }

    const user = await User.findById(req.user.id).select("+password");
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    
    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect old password" });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    await user.save();

    res.json({ success: true, message: "Password updated successfully" });

  } catch (err) {
    console.error("Change Password Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};