const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/auth");
const { listAlerts } = require("../controllers/alert.controller");

router.use(authenticate);

router.get("/", listAlerts);

module.exports = router;
