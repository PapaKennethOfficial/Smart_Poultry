const express = require("express")
const router = express.Router()

const { authenticate } = require("../middleware/auth")
const roleGuard = require("../middleware/roleGuard")
const {
  getDemandForecast,
  getEggForecast,
  getForecastSeries,
  getForecastDiagnostics,
  retrainForecast,
  optimizeRoutes,
  getMorningBriefing,
  askInsight,
  explainChart,
  listExplainableCharts,
} = require("../controllers/aiAnalytics.controller")

// All AI endpoints are for managers and admins only. Delivery staff and
// customers do not consume forecasts or routing directly — they get the
// materialised results (assigned deliveries, dashboard summaries) instead.
router.use(authenticate)
router.use(roleGuard(["ADMIN", "MANAGER"]))

router.get("/forecast/demand", getDemandForecast)
router.get("/forecast/eggs", getEggForecast)
router.get("/forecast/series", getForecastSeries)
router.get("/forecast/diagnostics", getForecastDiagnostics)
router.post("/forecast/retrain", retrainForecast)
router.post("/routes/optimize", optimizeRoutes)
router.post("/insights/morning-briefing", getMorningBriefing)
router.post("/insights/ask", askInsight)
router.get("/insights/charts", listExplainableCharts)
router.post("/insights/explain-chart", explainChart)

module.exports = router
