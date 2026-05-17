const { z } = require("zod");
// validate is centralised — import from the canonical middleware location
const validate = require("../middleware/validate");

// ─── Schemas ──────────────────────────────────────────────────────────────────

const registerSchema = z.object({
  name:     z.string({ required_error: "Name is required" }).trim().min(1, "Name is required"),
  email:    z.string({ required_error: "Email is required" }).email("Invalid email format"),
  password: z.string({ required_error: "Password is required" }).min(6, "Password must be at least 6 characters"),
  role:     z.enum(["ADMIN", "MANAGER", "WORKER"]).optional(),
});

const loginSchema = z.object({
  email:    z.string({ required_error: "Email is required" }).email("Invalid email format"),
  password: z.string({ required_error: "Password is required" }).min(1, "Password is required"),
});

// ─── Exports ──────────────────────────────────────────────────────────────────
// validate is re-exported so callers can keep using:
//   const { validate, loginSchema } = require("../validators/authValidator")

module.exports = { registerSchema, loginSchema, validate };
