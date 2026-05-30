const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { createDeliverySchema, updateStatusSchema } = require("../validators/deliveryValidator");
const {
  getDeliveries,
  getAvailableDrivers,
  createDelivery,
  updateDeliveryStatus,
  getDeliveryRevenue,
} = require("../controllers/delivery.controller");

// ─── All delivery routes require authentication ──────────────────────────────
router.use(authenticate);

// ─── Routes ──────────────────────────────────────────────────────────────────
// NOTE: /revenue must come BEFORE /:id to prevent Express treating "revenue" as an :id
router.get("/revenue", getDeliveryRevenue);
router.get("/available-drivers", requireRole(["MANAGER", "ADMIN"]), getAvailableDrivers);
router.get("/", getDeliveries);
router.post("/", requireRole(["MANAGER", "ADMIN"]), validate(createDeliverySchema), createDelivery);
router.patch("/:id/status", requireRole(["MANAGER", "ADMIN"]), validate(updateStatusSchema), updateDeliveryStatus);

module.exports = router;
