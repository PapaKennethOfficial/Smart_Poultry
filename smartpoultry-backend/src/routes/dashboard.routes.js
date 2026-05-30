const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const {
  getSummary,
  getEggChart,
  getMortalityChart,
} = require("../controllers/dashboard.controller");

// All dashboard routes are protected per project convention
// (only /auth/login and /auth/register are public).
router.use(authenticate);

router.get("/summary", getSummary);
router.get("/egg-chart", getEggChart);
router.get("/mortality-chart", getMortalityChart);

module.exports = router;
