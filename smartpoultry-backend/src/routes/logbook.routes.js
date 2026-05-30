const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/auth");
const authorize = require("../middleware/role");
const {
  getLogbook,
  createLogEntry,
  updateLogEntry,
  deleteLogEntry,
} = require("../controllers/logbook.controller");

// Require authentication for all logbook routes
router.use(authenticate);

// Everyone can view logbook (WORKER, MANAGER, ADMIN)
router.get("/", getLogbook);

// Workers, Managers, Admins can create
router.post("/", createLogEntry);

// Only Managers and Admins can update/delete entries
router.put("/:id", authorize(["ADMIN", "MANAGER"]), updateLogEntry);
router.delete("/:id", authorize(["ADMIN", "MANAGER"]), deleteLogEntry);

module.exports = router;
