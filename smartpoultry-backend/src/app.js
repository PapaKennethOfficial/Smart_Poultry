require("dotenv").config();
const express = require("express");
const cors = require("cors");
const routes = require("./routes");
const errorHandler = require("./middleware/errorHandler");
const path = require("path");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const auditLog = require("./middleware/auditLog");
const reportRoutes = require("./routes/report.routes");
const uploadRoutes = require("./routes/upload.routes");

const app = express();

// ─── Rate Limiter Configuration ───────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per windowMs
  message: { message: "Too many requests, please try again later." }
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet());
app.use(compression());
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json({ limit: "1mb" })); // Reduced from 10mb to 1mb for security (prevents large payload DOS)

// ─── Static Files (report downloads) ──────────────────────────────────────────
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// ─── Health Check ────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ message: "SmartPoultry API is running 🐔" });
});

// ─── Audit Log Middleware ─────────────────────────────────────────────────────
app.use(auditLog);

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api", limiter, routes);
app.use("/api/reports", limiter, reportRoutes);
app.use("/api/upload", limiter, uploadRoutes);

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
