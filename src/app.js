const express = require("express");
const cors = require("cors");
const helmet = require("helmet"); // 🛡️ NEW
const connectDB = require("./config/db");
const { PORT } = require("./config/env");
const { globalLimiter, authLimiter } = require("./middleware/limiters"); // 🛡️ NEW

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
const healthRoutes = require("./routes/health.routes");
const app = express();

/* ================= SECURITY ================= */
// 1. Set Security Headers
app.use(helmet());

// 2. Rate Limiting (Global)
app.use(globalLimiter);

// 3. CORS (Allow env config or fallbacks)
// Check if CORS_ORIGIN is a comma-separated string in .env, otherwise use defaults
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(",") 
  : ["http://localhost:5173", "http://localhost:3000"];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json({ limit: "10kb" })); // Body limit to prevent DoS

/* ================= DB ================= */
connectDB();

/* ================= ROUTES ================= */
// Apply stricter limiter ONLY to Auth
app.use("/api/v1/auth", authLimiter, authRoutes);

// Other Routes
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
app.use("/health", healthRoutes);
/* ================= ERROR HANDLING ================= */
// Global Error Handler (Replaces repeated try-catch blocks)
app.use((err, req, res, next) => {
  console.error("🔥 Global Error:", err.stack);
  res.status(500).json({ 
    message: "Internal Server Error", 
    error: process.env.NODE_ENV === "development" ? err.message : undefined 
  });
});

app.get("/", (req, res) => {
  res.send("Saraswati Club SaaS Backend (v1.1 Secured) is Running");
});

module.exports = { app, PORT };