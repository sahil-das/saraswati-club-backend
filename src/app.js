const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const { PORT } = require("./config/env");

// 1. Import New SaaS Routes
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

/* ================= CORS ================= */
app.use(
  cors({
    origin: [
      "http://localhost:5173",       // Local Laptop
      "http://10.155.91.46:5173"     // Phone/Network IP (Update as needed)
    ],
    credentials: true,
  })
);

app.use(express.json());

/* ================= DB ================= */
connectDB();

/* ================= ROUTES ================= */
// 🚀 SaaS API Structure (v1)

// Identity & Access
app.use("/api/v1/auth", authRoutes);            // Login / Register Club
app.use("/api/v1/members", membershipRoutes);   // Manage Club Members

// Core Context
app.use("/api/v1/years", festivalYearRoutes);   // Create/Manage Events (Durga Puja 2025)

// Financials (Income)
app.use("/api/v1/subscriptions", subscriptionRoutes); // Weekly/Monthly Collections
app.use("/api/v1/member-fees", memberFeeRoutes);      // One-time Chanda
app.use("/api/v1/donations", donationRoutes);         // Public Donations

// Financials (Expense & Stats)
app.use("/api/v1/expenses", expenseRoutes);     // Expenses
app.use("/api/v1/finance", financeRoutes);      // Dashboard Summary
app.use("/api/v1/audit", require("./routes/audit.routes"));
app.use("/api/v1/archives", archiveRoutes);
app.use("/api/v1/notices", noticeRoutes);
/* ================= ROOT ================= */
app.get("/", (req, res) => {
  res.send("Saraswati Club SaaS Backend (v1) is Running");
});

module.exports = { app, PORT };