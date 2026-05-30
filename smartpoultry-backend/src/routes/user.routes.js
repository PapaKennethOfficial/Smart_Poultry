const express = require("express");
const router = express.Router();

const { authenticate } = require("../middleware/auth");
const roleGuard = require("../middleware/roleGuard");
const validate = require("../middleware/validate");
const {
  updateProfileSchema,
  updatePasswordSchema,
  updateNotificationsSchema,
} = require("../validators/userValidator");
const {
  getMe,
  updateMe,
  updateNotifications,
  updatePassword,
  listUsers,
} = require("../controllers/user.controller");

// All routes require an authenticated user.
router.use(authenticate);

// ─── /me routes ──────────────────────────────────────────────────────────────
// /me/* MUST come before any future /:id routes to keep "me" from being
// interpreted as a user id.
router.get("/me", getMe);
router.put("/me", validate(updateProfileSchema), updateMe);
router.patch("/me/notifications", validate(updateNotificationsSchema), updateNotifications);
router.patch("/me/password", validate(updatePasswordSchema), updatePassword);

// ─── Admin / Manager only ────────────────────────────────────────────────────
router.get("/", roleGuard(["ADMIN", "MANAGER"]), listUsers);

module.exports = router;
