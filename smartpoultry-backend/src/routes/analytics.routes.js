const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const authorize = require("../middleware/role");
const {
  getForecast,
  getFCR,
  getInsights,
  getEnvironmental,
} = require("../controllers/analytics.controller");

// ─── All analytics routes require authentication & high-level roles ──────────
router.use(authenticate);
router.use(authorize(["ADMIN", "MANAGER"]));

// ─── Routes ───────────────────────────────────────────────────────────────────
router.get("/forecast", getForecast);
router.get("/fcr", getFCR);
router.get("/insights", getInsights);
router.get("/environmental", getEnvironmental);

module.exports = router;
