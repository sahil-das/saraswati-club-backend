const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const connectDB = require("./config/db");
const { PORT } = require("./config/env");

// Import the Global Limiter
const { globalLimiter } = require("./middleware/limiters");

// Import Routes
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

/* ================= 1. SECURITY HEADERS ================= */
app.use(helmet());

/* ================= 2. CORS (MUST BE BEFORE LIMITERS) ================= */
// If we don't put this first, the limiter blocks the "Preflight" check 
// and the browser throws a CORS error instead of a 429 error.
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

/* ================= 3. RATE LIMITER ================= */
app.use(globalLimiter);

/* ================= 4. PARSERS ================= */
app.use(express.json({ limit: "10kb" }));

/* ================= 5. DB & ROUTES ================= */
connectDB();

app.use("/api/v1/auth", authRoutes);
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
app.get("/", (req, res) => {
  res.send("Saraswati Club SaaS Backend (v1) is Secure & Running");
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: "Internal Server Error", 
    error: process.env.NODE_ENV === "development" ? err.message : undefined 
  });
});

module.exports = { app, PORT };