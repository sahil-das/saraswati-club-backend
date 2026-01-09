const rateLimit = require("express-rate-limit");

// 1. General Limiter (Applied to all routes)
// Production: 300 req / 15 min (Approx 1 req every 3 seconds per IP)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 900, 
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests from this IP, please try again later." }
});

// 2. Auth Limiter (Stricter for Login/Register)
// Production: 5 attempts / 15 min (Prevents Brute Force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 775, 
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please try again in 15 minutes." }
});

module.exports = { globalLimiter, authLimiter };
