const rateLimit = require("express-rate-limit");

// 1. General Limiter (Applied to all routes)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30000, // Limit each IP to 300 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests from this IP, please try again later." }
});

// 2. Auth Limiter (Stricter for Login/Register)
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // Limit each IP to 10 login/register attempts per hour
  message: { message: "Too many login attempts, please try again after an hour." }
});

module.exports = { globalLimiter, authLimiter };