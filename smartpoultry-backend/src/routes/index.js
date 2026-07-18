const { Router } = require("express");
const router = Router();

// ─── Auth routes (public) ─────────────────────────────────────────────────────
const authRoutes = require("../routes/auth.routes")
router.use("/auth", authRoutes)

// ─── Original routes (used by the current frontend) ───────────────────────────
const deliveryRoutes = require("../routes/delivery.routes")
const dashboardRoutes = require("../routes/dashboard.routes")
const alertRoutes = require("../routes/alert.routes")
const userRoutes = require("../routes/user.routes")
const reportRoutes = require("../routes/report.routes")
const analyticsRoutes = require("../routes/analytics.routes")
const auditRoutes = require("../routes/audit.routes")
const notificationRoutes = require("../routes/notification.routes")
const logbookRoutes = require("../routes/logbook.routes")
const vehicleRoutes = require("../routes/vehicle.routes")
const orderRoutes = require("../routes/order.routes")
const productRoutes = require("../routes/product.routes")
const aiRoutes = require("../routes/ai.routes")

router.use("/deliveries", deliveryRoutes)
router.use("/dashboard", dashboardRoutes)
router.use("/alerts", alertRoutes)
router.use("/users", userRoutes)
router.use("/reports", reportRoutes)
router.use("/analytics", analyticsRoutes)
router.use("/logs", auditRoutes)
router.use("/notifications", notificationRoutes)
router.use("/logbook", logbookRoutes)
router.use("/vehicles", vehicleRoutes)
router.use("/orders", orderRoutes)
router.use("/products", productRoutes)
router.use("/ai", aiRoutes)

// ─── Namespaced v1 routes with strict RBAC (for future mobile apps) ───────────
// const adminRoutes = require("../routes/admin");
// const driverRoutes = require("../routes/driver");
// const customerRoutes = require("../routes/customer");

// router.use("/v1/admin", adminRoutes);
// router.use("/v1/driver", driverRoutes);
// router.use("/v1/customer", customerRoutes);

// ─── Health ───────────────────────────────────────────────────────────────────
router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

module.exports = router;
