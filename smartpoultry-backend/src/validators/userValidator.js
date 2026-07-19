const { z } = require("zod");

// ─── Schemas ──────────────────────────────────────────────────────────────────

const updateProfileSchema = z.object({
  name:  z.string().trim().min(1, "Name is required").optional(),
  email: z.string().email("Invalid email format").optional(),
  phone: z.string().trim().min(1).optional().nullable(),
  avatarUrl: z.string().trim().optional().nullable(),
}).strict();

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword:     z.string().min(6, "New password must be at least 6 characters"),
});

// Notification preferences are an open dictionary of boolean toggles — we
// validate the shape (object of booleans) without locking the key list,
// so the frontend can add new toggles without backend changes.
const updateNotificationsSchema = z.object({
  preferences: z.record(z.string(), z.boolean()),
});

module.exports = {
  updateProfileSchema,
  updatePasswordSchema,
  updateNotificationsSchema,
};
