const rateLimit = require("express-rate-limit");

// Skip preflight requests
const skipOptions = (req) => req.method === "OPTIONS";

// 1. Global Limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipOptions,
  message: { message: "Too many requests from this IP, please try again later." }
});

// 2. Auth Limiter (Login/Register)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // ← your comment says 5; 775 was unsafe
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipOptions,
  message: { message: "Too many login attempts. Please try again in 15 minutes." }
});

module.exports = { globalLimiter, authLimiter };
