const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

/**
 * LOGIN
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Validate input
    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    // 2. Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // 3. Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // 4. Generate token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // 5. Respond
    res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({
      message: "Login failed",
    });
  }
};

/**
 * GET CURRENT USER (for refresh)
 */
exports.getMe = async (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
};
/* ================= UPDATE PROFILE (Name/Phone) ================= */
exports.updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findById(req.user._id);

    if (name) user.name = name;
    if (phone) user.phone = phone;

    await user.save();

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone
      }
    });
  } catch (err) {
    res.status(500).json({ message: "Update failed" });
  }
};

/* ================= CHANGE PASSWORD ================= */
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // 1. Check User ID
    console.log("User in Request:", req.user); 
    const userId = req.user._id || req.user.id; 

    if (!userId) {
      return res.status(401).json({ message: "User ID missing. Auth Middleware failed." });
    }

    // 2. Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Please provide both current and new passwords" });
    }

    // 3. Find User (explicitly select password)
    const user = await User.findById(userId).select("+password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 4. Verify Current Password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect current password" });
    }

    // 5. HASH NEW PASSWORD (✅ FIXED HERE)
    // We generate a salt and hash the password manually
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    await user.save();

    res.status(200).json({ 
      success: true, 
      message: "Password updated successfully" 
    });

  } catch (error) {
    console.error("❌ CHANGE PASSWORD ERROR:", error);
    res.status(500).json({ message: "Server error updating password: " + error.message });
  }
};