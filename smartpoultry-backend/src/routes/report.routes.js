const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const authorize = require("../middleware/role");
const {
  generateReport,
  getReportHistory,
} = require("../controllers/report.controller");

// ─── All report routes require authentication & high-level roles ─────────────
router.use(authenticate);
router.use(authorize(["ADMIN", "MANAGER"]));

// ─── Routes ───────────────────────────────────────────────────────────────────
// NOTE: /history must come BEFORE any /:id route to prevent Express treating "history" as an :id
router.get("/history", getReportHistory);
router.post("/", generateReport);

module.exports = router;
