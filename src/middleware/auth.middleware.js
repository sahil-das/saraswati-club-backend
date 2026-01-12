const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Membership = require("../models/Membership");
const logger = require("../utils/logger");
const mongoose = require("mongoose"); // ✅ Added for ObjectId validation

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      // 1. Get Token
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 2. Get User
      const user = await User.findById(decoded.id).select("-password");
      if (!user) return res.status(401).json({ message: "Not authorized, user not found" });

      req.user = user; // Attach base user

      // 3. 🛡️ HANDLE CLUB CONTEXT (Multi-Tenancy)
      // We look for the 'x-club-id' header sent by the frontend/Postman
      const headerClubId = req.headers['x-club-id'];

      // ✅ FIX: Only process if it's a REAL, VALID ObjectId (Ignore "null", "undefined", etc.)
      if (headerClubId && headerClubId !== "null" && headerClubId !== "undefined" && mongoose.isValidObjectId(headerClubId)) {
        
        // Verify the user actually belongs to this club
        const membership = await Membership.findOne({ 
            user: user._id, 
            club: headerClubId, 
            status: "active" 
        });

        if (membership) {
            // ✅ Attach context to req.user for Controllers to use
            req.user.clubId = headerClubId;
            req.user.role = membership.role; 
        } 
        // 🚀 BYPASS: If no membership, but user is Platform Admin, ALLOW access
        else if (user.isPlatformAdmin) {
            req.user.clubId = headerClubId;
            req.user.role = "admin"; // Grant admin privileges for this request
        }
        else {
            // If they send a random Club ID they don't belong to
            return res.status(403).json({ message: "Access Denied: You are not a member of this club." });
        }
      }

      next();
    } catch (error) {
      logger.error("Auth Middleware Error", { 
        error: error.message,
        // stack: error.stack, 
        ip: req.ip,            
        path: req.originalUrl 
      });
      res.status(401).json({ message: "Not authorized, token failed" });
    }
  } else {
    res.status(401).json({ message: "Not authorized, no token" });
  }
};

module.exports = protect;