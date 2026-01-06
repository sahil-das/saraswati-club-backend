const rateLimit = require("express-rate-limit");

// 1. Strict Limiter (For Login/Register only)
// Prevents password guessing.
exports.authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'development' ? 1000 : 5000, // Lenient in dev, strict in prod
  message: { message: "Too many login attempts. Please try again later." }
});

// 2. Global Limiter (For all other routes)
// Prevents DDoS/spam.
exports.globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 100 requests per 15 min
  standardHeaders: true,
  legacyHeaders: false
});