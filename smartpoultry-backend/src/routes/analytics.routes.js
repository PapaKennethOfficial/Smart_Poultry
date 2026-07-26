const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const authorize = require("../middleware/role");
const {
  getForecast,
  getFCR,
  getInsights,
  getFulfilmentFunnel,
  getDriverEfficiency,
  getOrderHeatmap,
  getSalesTracker,
} = require("../controllers/analytics.controller");

// ─── All analytics routes require authentication & high-level roles ──────────
router.use(authenticate);
router.use(authorize(["ADMIN", "MANAGER"]));

// ─── Routes ───────────────────────────────────────────────────────────────────
router.get("/forecast", getForecast);
router.get("/fcr", getFCR);
router.get("/insights", getInsights);
router.get("/fulfilment-funnel", getFulfilmentFunnel);
router.get("/driver-efficiency", getDriverEfficiency);
router.get("/order-heatmap", getOrderHeatmap);
router.get("/sales-tracker", getSalesTracker);

module.exports = router;
