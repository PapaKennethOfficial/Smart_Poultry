const { Router } = require("express");
const router = Router();

const authRoutes = require("../routes/auth.routes")
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

router.use("/auth", authRoutes)
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

router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

module.exports = router;
