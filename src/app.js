const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit"); // 👈 NEW
const connectDB = require("./config/db");
const { PORT } = require("./config/env");

// Routes
const authRoutes = require("./routes/auth.routes");
const membershipRoutes = require("./routes/membership.routes");
const festivalYearRoutes = require("./routes/festivalYear.routes");
const subscriptionRoutes = require("./routes/subscription.routes");
const memberFeeRoutes = require("./routes/memberFee.routes");
const donationRoutes = require("./routes/donations.routes");
const expenseRoutes = require("./routes/expenses.routes");
const financeRoutes = require("./routes/finance.routes");
const archiveRoutes = require("./routes/archive.routes");
const noticeRoutes = require("./routes/notice.routes");

const app = express();

/* ================= SECURITY ================= */
app.use(helmet());

// 1. Global Rate Limiter (General DDoS Protection)
// Allow 100 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." }
});
app.use(globalLimiter);

// 2. Auth Rate Limiter (Brute Force Protection)
// Allow only 5 login attempts per hour per IP
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 5,
  message: { message: "Too many login attempts. Please try again in an hour." }
});

/* ================= CONFIG ================= */
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(",") 
  : ["http://localhost:5173"];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        if (process.env.NODE_ENV === 'development') return callback(null, true);
        return callback(new Error('CORS blocked'), false);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "10kb" }));

/* ================= DB ================= */
connectDB();

/* ================= ROUTES ================= */
// Apply strict limiter ONLY to auth routes
app.use("/api/v1/auth", authLimiter, authRoutes); // 👈 Applied here

app.use("/api/v1/members", membershipRoutes);
app.use("/api/v1/years", festivalYearRoutes);
app.use("/api/v1/subscriptions", subscriptionRoutes);
app.use("/api/v1/member-fees", memberFeeRoutes);
app.use("/api/v1/donations", donationRoutes);
app.use("/api/v1/expenses", expenseRoutes);
app.use("/api/v1/finance", financeRoutes);
app.use("/api/v1/audit", require("./routes/audit.routes"));
app.use("/api/v1/archives", archiveRoutes);
app.use("/api/v1/notices", noticeRoutes);

/* ================= ERROR HANDLING ================= */
app.get("/", (req, res) => res.send("Saraswati Club Backend (Secured)"));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined 
  });
});

module.exports = { app, PORT };