const { Router } = require("express");
const router = Router();

const authRoutes = require("../routes/auth.routes")
const deliveryRoutes = require("../routes/delivery.routes")
const reportRoutes = require("../routes/report.routes")
const analyticsRoutes = require("../routes/analytics.routes")
const auditRoutes = require("../routes/audit.routes")

// ─── Route Modules ────────────────────────────────────────────────────────────
// Register additional routes here as they are built, e.g.:
router.use("/auth", authRoutes)
router.use("/deliveries", deliveryRoutes)
router.use("/reports", reportRoutes)
router.use("/analytics", analyticsRoutes)
router.use("/logs", auditRoutes)
// router.use("/farms",    require("./farm.routes"));
// router.use("/batches",  require("./batch.routes"));

// ─── Health Check ─────────────────────────────────────────────────────────────
router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

module.exports = router;
