const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Membership = require("../models/Membership");

module.exports = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // 1. Verify Token (Authentication)
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findById(decoded.id).select("-password");
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Attach global user info
      req.user = {
        id: user._id,
        name: user.name,
        email: user.email,
        isPlatformAdmin: user.isPlatformAdmin
      };

      // 2. Check for Club Context (Authorization)
      // The frontend must send 'x-club-id' header when acting inside a dashboard
      const clubId = req.headers["x-club-id"];

      if (clubId) {
        // Verify this user is actually a member of this club
        const membership = await Membership.findOne({
          user: user._id,
          club: clubId,
          status: "active"
        });

        if (!membership) {
          return res.status(403).json({ message: "You are not a member of this club." });
        }

        // 🚀 INJECT CONTEXT
        // Now controllers can use req.user.clubId and req.user.role
        req.user.clubId = membership.club;
        req.user.role = membership.role; 
      }

      next();
    } catch (error) {
      console.error("Auth Middleware Error:", error);
      res.status(401).json({ message: "Not authorized, token failed" });
    }
  } else {
    res.status(401).json({ message: "Not authorized, no token" });
  }
};