const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto"); 

const User = require("../models/User");
const Club = require("../models/Club");
const Membership = require("../models/Membership");
const RefreshToken = require("../models/RefreshToken");

/**
 * 🛡️ HELPER: Generate Access & Refresh Tokens
 */
const generateTokens = async (user, ipAddress) => {
  // 1. Access Token (Short-lived: 15 mins)
  const accessToken = jwt.sign(
    { id: user._id }, 
    process.env.JWT_SECRET, 
    { expiresIn: "15m" }
  );

  // 2. Refresh Token (Long-lived: 7 days)
  const refreshTokenString = crypto.randomBytes(40).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); 

  // 3. Save to DB
  await RefreshToken.create({
    user: user._id,
    token: refreshTokenString,
    expiresAt,
    createdByIp: ipAddress
  });

  return { accessToken, refreshToken: refreshTokenString };
};

/**
 * REGISTER NEW FESTIVAL COMMITTEE
 * (Now using Transactions for Data Integrity)
 */
exports.registerClub = async (req, res) => {
  let session;
  try {
    // 1. Start Transaction
    session = await mongoose.startSession();
    session.startTransaction();

    const { clubName, clubCode, adminName, username, email, password, phone } = req.body;

    if (!clubName || !clubCode || !adminName || !username || !email || !password) {
        throw new Error("All fields are required");
    }

    // 2. Validate Club Code
    const cleanClubCode = clubCode.trim().toLowerCase();
    if (/[^a-z0-9-_]/.test(cleanClubCode)) {
        throw new Error("Club Code must only contain letters, numbers, hyphens, or underscores.");
    }

    // Check existence (outside transaction to fail fast, or inside for lock? 
    // Mongoose unique index will catch it, but explicit check is friendlier)
    const existingClub = await Club.findOne({ code: cleanClubCode }).session(session);
    if (existingClub) throw new Error("Club Code is already taken. Please choose another.");

    // 3. Construct System Login ID
    const cleanUsername = username.trim().toLowerCase();
    if (/[^a-z0-9.]/.test(cleanUsername)) {
        throw new Error("Username must only contain letters, numbers, or dots.");
    }
    
    const systemLoginId = `${cleanUsername}@${cleanClubCode}.com`;
    const idTaken = await User.findOne({ email: systemLoginId }).session(session);
    if (idTaken) throw new Error(`The Login ID '${systemLoginId}' is already taken.`);

    // 4. Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 5. Create User (Pass Session)
    const [newUser] = await User.create([{
      name: adminName,
      email: systemLoginId,
      personalEmail: email,
      password: hashedPassword,
      phone,
      isPlatformAdmin: false
    }], { session });

    // 6. Create Club (Pass Session)
    // ⚠️ Note: 'settings' removed as they are now handled in FestivalYear
    const [newClub] = await Club.create([{
      name: clubName,
      code: cleanClubCode,
      owner: newUser._id
    }], { session });

    // 7. Create Membership (Pass Session)
    await Membership.create([{
      user: newUser._id,
      club: newClub._id,
      role: "admin",
      status: "active"
    }], { session });

    // 8. Commit Transaction
    await session.commitTransaction();
    session.endSession();

    // 9. Generate Tokens (After successful commit)
    // We do this outside the main transaction to avoid complex coupling, 
    // ensuring the user exists first.
    const { accessToken, refreshToken } = await generateTokens(newUser, req.ip);

    res.status(201).json({
      success: true,
      message: "Club registered successfully!",
      accessToken,
      refreshToken,
      user: { 
          id: newUser._id, 
          name: newUser.name, 
          email: newUser.email, 
          personalEmail: newUser.personalEmail 
      },
      club: { id: newClub._id, name: newClub.name, code: newClub.code }
    });

  } catch (err) {
    if (session) {
        await session.abortTransaction();
        session.endSession();
    }
    console.error("Registration Error:", err);
    res.status(400).json({ message: err.message });
  }
};

/**
 * LOGIN USER
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) return res.status(400).json({ message: "Please provide ID and password" });

    const user = await User.findOne({ 
      $or: [{ email: email.toLowerCase() }, { personalEmail: email.toLowerCase() }] 
    }).select("+password");

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // ⚠️ Updated population: 'settings' no longer exists on Club
    const memberships = await Membership.find({ user: user._id, status: "active" }).populate("club", "name code");
    if (memberships.length === 0) return res.status(403).json({ message: "You are not a member of any club." });

    const { accessToken, refreshToken } = await generateTokens(user, req.ip);

    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: { id: user._id, name: user.name, email: user.email },
      clubs: memberships.map(m => ({
        clubId: m.club._id,
        clubName: m.club.name,
        clubCode: m.club.code,
        role: m.role,
        // frequency: null // Settings moved to FestivalYear
      }))
    });

  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * 🔄 REFRESH TOKEN (Get new Access Token)
 */
exports.refreshToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "Token is required" });

    // 1. Find token in DB
    const rToken = await RefreshToken.findOne({ token }).populate('user');
    
    if (!rToken || !rToken.isActive) {
      if (rToken && rToken.revoked) {
        console.warn(`🚨 Security: Reuse of revoked token detected for user ${rToken.user._id}`);
      }
      return res.status(403).json({ message: "Refresh token is invalid or expired" });
    }

    // 2. Rotate Token
    rToken.revoked = Date.now();
    rToken.revokedByIp = req.ip;
    rToken.replacedByToken = "new_generated_below";
    await rToken.save();

    // 3. Generate New Pair
    const { accessToken, refreshToken } = await generateTokens(rToken.user, req.ip);
    
    rToken.replacedByToken = refreshToken;
    await rToken.save();

    res.json({ accessToken, refreshToken });

  } catch (err) {
    console.error("Refresh Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * 🚪 LOGOUT (Revoke Token)
 */
exports.revokeToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "Token is required" });

    const rToken = await RefreshToken.findOne({ token });
    
    if (!rToken) return res.status(404).json({ message: "Token not found" });
    if (!rToken.isActive) return res.status(400).json({ message: "Token already inactive" });

    rToken.revoked = Date.now();
    rToken.revokedByIp = req.ip;
    await rToken.save();

    res.json({ message: "Token revoked successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ... Include existing getMe, updateProfile, changePassword ...
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const memberships = await Membership.find({ user: user._id, status: "active" })
          .populate("club", "name code"); // ⚠️ settings removed
    
        res.json({
          success: true,
          user,
          clubs: memberships.map(m => ({
            clubId: m.club._id,
            clubName: m.club.name,
            clubCode: m.club.code,
            role: m.role,
            // frequency: null // Moved to Year
          }))
        });
      } catch (err) {
        console.error("GetMe Error:", err);
        res.status(500).json({ message: "Server error" });
      }
};

exports.updateProfile = async (req, res) => {
    try {
        const { name, phone, email } = req.body;
        
        const user = await User.findByIdAndUpdate(
          req.user.id,
          { name, phone, email },
          { new: true, runValidators: true }
        ).select("-password");
    
        res.json({
          success: true,
          data: user,
          message: "Profile updated successfully"
        });
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
      }
};

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