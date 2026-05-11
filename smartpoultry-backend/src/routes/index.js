const { Router } = require("express");
const router = Router();

const authRoutes = require("../routes/auth.routes")
const deliveryRoutes = require("../routes/delivery.routes")

// ─── Route Modules ────────────────────────────────────────────────────────────
// Register additional routes here as they are built, e.g.:
router.use("/auth", authRoutes)
router.use("/deliveries", deliveryRoutes)
// router.use("/farms",    require("./farm.routes"));
// router.use("/batches",  require("./batch.routes"));

// ─── Health Check ─────────────────────────────────────────────────────────────
router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

module.exports = router;
