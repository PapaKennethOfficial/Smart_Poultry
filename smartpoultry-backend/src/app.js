require("dotenv").config();
const express = require("express");
const cors = require("cors");
const routes = require("./routes");
const errorHandler = require("./middleware/errorHandler");
const path = require("path");
const auditLog = require("./middleware/auditLog");
const reportRoutes = require("./routes/report.routes");
const uploadRoutes = require("./routes/upload.routes");

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));

// ─── Static Files (report downloads) ──────────────────────────────────────────
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// ─── Health Check ────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ message: "SmartPoultry API is running 🐔" });
});

// ─── Audit Log Middleware ─────────────────────────────────────────────────────
app.use(auditLog);

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api", routes);
app.use("/api/reports", reportRoutes);
app.use("/api/upload", uploadRoutes);

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
