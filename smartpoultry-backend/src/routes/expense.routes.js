const express = require("express");
const router = express.Router();
const { getExpenses, createExpense } = require("../controllers/expense.controller");
const { requireAuth, requireRole } = require("../middleware/auth");

router.use(requireAuth);
router.use(requireRole(["ADMIN", "MANAGER"]));

router.get("/", getExpenses);
router.post("/", createExpense);

module.exports = router;
