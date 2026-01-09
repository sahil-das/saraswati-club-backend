const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const connectDB = require("./config/db");
const { PORT } = require("./config/env");
const { globalLimiter, authLimiter } = require("./middleware/limiters");

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
const auditRoutes = require("./routes/audit.routes"); // 👈 Clean Import

const app = express();

/* ================= SECURITY & CONFIG ================= */

// 1. CORS (MUST BE FIRST) 🚨
// This ensures headers are present even if rate limits are hit or errors occur.
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(",") 
  : ["http://localhost:5173", "http://localhost:3000"];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// 2. Set Security Headers
// We enable Cross-Origin Resource Policy to allow frontend access to assets if needed
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// 3. Rate Limiting (Global)
app.use(globalLimiter);

// 4. Body Parser (Limit to 10kb to prevent DoS)
app.use(express.json({ limit: "10kb" }));

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
app.use("/api/v1/audit", auditRoutes); 
app.use("/api/v1/archives", archiveRoutes);
app.use("/api/v1/notices", noticeRoutes);
app.use("/health", healthRoutes);

/* ================= ERROR HANDLING ================= */
// Global Error Handler
app.use((err, req, res, next) => {
  console.error("🔥 Global Error:", err.stack);
  
  // 🛡️ CRASH PREVENTION: If headers are already sent, delegate to default Express handler
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  
  const response = { message };
  
  if (err.field) response.field = err.field; // Useful for form validation errors
  
  // Only show detailed error stack in Development
  if (process.env.NODE_ENV === "development") {
      response.error = err.message;
      // response.stack = err.stack; // Optional: include stack trace if needed
  }
  
  res.status(statusCode).json(response);
});

app.get("/", (req, res) => {
  res.send("Saraswati Club SaaS Backend (v1.1 Secured) is Running");
});

module.exports = { app, PORT };