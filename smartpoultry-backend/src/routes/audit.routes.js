const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const authorize = require("../middleware/role");
const { getAuditLogs } = require("../controllers/report.controller");

// ─── All audit routes require authentication ──────────────────────────────────
router.use(authenticate);
router.use(authorize(["ADMIN"]));

// ─── Routes ───────────────────────────────────────────────────────────────────
router.get("/audit", getAuditLogs);

module.exports = router;
