const { z } = require("zod");

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createDeliverySchema = z.object({
  customer: z
    .string({ required_error: "Customer name is required" })
    .trim()
    .min(1, "Customer name is required"),
  product: z
    .string({ required_error: "Product type is required" })
    .trim()
    .min(1, "Product type is required"),
  quantity: z
    .number({ required_error: "Quantity is required" })
    .int("Quantity must be a whole number")
    .positive("Quantity must be positive"),
  driver: z.string().trim().optional().default("Unassigned"),
  deliveryDate: z
    .string({ required_error: "Delivery date is required" })
    .min(1, "Delivery date is required"),
  address: z.string().trim().optional().default(""),
  amount: z
    .number({ required_error: "Amount is required" })
    .positive("Amount must be positive"),
  notes: z.string().trim().optional().default(""),
});

const updateStatusSchema = z.object({
  status: z.enum(["Pending", "In Transit", "Delivered", "Cancelled"], {
    required_error: "Status is required",
    invalid_type_error: "Status must be one of: Pending, In Transit, Delivered, Cancelled",
  }),
});

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { createDeliverySchema, updateStatusSchema };
