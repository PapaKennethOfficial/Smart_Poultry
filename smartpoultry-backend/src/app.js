require("dotenv").config();
const express = require("express");
const cors = require("cors");
const routes = require("./routes");
const errorHandler = require("./middleware/errorHandler");
const path = require("path");
const auditLog = require("./middleware/auditLog");

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json());

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

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
