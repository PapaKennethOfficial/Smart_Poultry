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
  getSupplyVsDemand,
} = require("../controllers/analytics.controller");

// ─── All analytics routes require authentication & high-level roles ──────────
router.use(authenticate);
router.use(authorize(["ADMIN", "MANAGER"]));

// ─── Routes ───────────────────────────────────────────────────────────────────
// Historical egg totals. `/forecast` is the deprecated name — it never
// forecast anything. Real predictions live at /api/ai/forecast/eggs.
router.get("/trend/eggs", getForecast);
router.get("/forecast", getForecast); // deprecated alias
router.get("/fcr", getFCR);
router.get("/insights", getInsights);
router.get("/fulfilment-funnel", getFulfilmentFunnel);
router.get("/driver-efficiency", getDriverEfficiency);
router.get("/order-heatmap", getOrderHeatmap);
router.get("/sales-tracker", getSalesTracker);
// The join between the farm half and the commerce half.
router.get("/supply-vs-demand", getSupplyVsDemand);

module.exports = router;
