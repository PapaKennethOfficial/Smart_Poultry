const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/auth");
const validate = require("../middleware/validate");
const { createDeliverySchema, updateStatusSchema } = require("../validators/deliveryValidator");
const {
  getDeliveries,
  createDelivery,
  updateDeliveryStatus,
  getDeliveryRevenue,
} = require("../controllers/delivery.controller");

// ─── All delivery routes require authentication ──────────────────────────────
router.use(authenticate);

// ─── Routes ──────────────────────────────────────────────────────────────────
// NOTE: /revenue must come BEFORE /:id to prevent Express treating "revenue" as an :id
router.get("/revenue", getDeliveryRevenue);
router.get("/", getDeliveries);
router.post("/", validate(createDeliverySchema), createDelivery);
router.patch("/:id/status", validate(updateStatusSchema), updateDeliveryStatus);

module.exports = router;
