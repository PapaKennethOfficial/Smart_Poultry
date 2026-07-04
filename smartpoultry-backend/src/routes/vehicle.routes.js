const express = require("express")
const { z } = require("zod")
const router = express.Router()
const prisma = require("../config/prisma")
const { requireAuth, requireRole } = require("../middleware/auth")

const VEHICLE_TYPES = ["Truck", "Van", "Motorcycle", "Bicycle"]
const VERIFICATION_STATUSES = ["PENDING", "APPROVED", "REJECTED"]

const imageDataSchema = z
  .string()
  .trim()
  .min(1, "Photo is required")
  .refine(
    (value) => value.startsWith("data:image/") || value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/uploads/"),
    "Photo must be an uploaded image"
  )

const optionalDocumentSchema = z
  .string()
  .trim()
  .optional()
  .nullable()
  .refine(
    (value) => !value || value.startsWith("data:image/") || value.startsWith("data:application/pdf") || value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/uploads/"),
    "Document must be an uploaded image or PDF"
  )

const vehicleBaseSchema = z.object({
  vehicle_type: z.enum(VEHICLE_TYPES),
  make: z.string().trim().min(1, "Make is required"),
  model: z.string().trim().min(1, "Model is required"),
  year_of_manufacture: z.coerce.number().int().min(1970).max(new Date().getFullYear() + 1),
  license_plate: z.string().trim().optional().nullable(),
  vin: z.string().trim().optional().nullable(),
  color: z.string().trim().min(1, "Color is required"),
  driver_contact_number: z.string().trim().min(7, "Driver contact number is required"),
  driver_residential_address: z.string().trim().min(5, "Residential address is required"),
  driver_license_number: z.string().trim().min(1, "Driver license number is required"),
  license_expiration: z.string().min(1, "License expiration is required"),
  vehicle_photo: imageDataSchema,
  driver_photo: imageDataSchema,
  registration_document: optionalDocumentSchema,
})

const vehicleSchema = vehicleBaseSchema.superRefine((data, ctx) => {
  const requiresFullDetails = !["Bicycle", "Motorcycle"].includes(data.vehicle_type)
  if (!requiresFullDetails) return

  const requiredFields = [
    ["license_plate", "License plate is required"],
    ["vin", "VIN is required"],
  ]

  requiredFields.forEach(([field, message]) => {
    if (!data[field]) ctx.addIssue({ code: "custom", path: [field], message })
  })
})

const verifySchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  notes: z.string().trim().optional().default(""),
  rejection_reason: z.string().trim().optional().default(""),
  changes_requested: z.string().trim().optional().default(""),
}).superRefine((data, ctx) => {
  if (data.status === "REJECTED" && !data.rejection_reason) {
    ctx.addIssue({
      code: "custom",
      path: ["rejection_reason"],
      message: "Rejection reason is required",
    })
  }
})

const managerUpdateSchema = vehicleBaseSchema.partial().extend({
  is_active: z.boolean().optional(),
  verification_notes: z.string().trim().optional().nullable(),
})

const deactivateSchema = z.object({
  reason: z.string().trim().min(5, "Removal reason is required"),
})

function parseBody(schema, req, res) {
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors })
    return null
  }
  return parsed.data
}

function parseDate(value, fieldName, res, required = false) {
  if (!value) {
    if (required) res.status(400).json({ message: `${fieldName} is required` })
    return null
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    res.status(400).json({ message: `${fieldName} is invalid` })
    return null
  }
  return date
}

async function notifyDriver(userId, title, message, type, metadata) {
  await prisma.userNotification.create({
    data: { userId, title, message, type, metadata },
  })
}

function includeDriver() {
  return {
    user: {
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        deliveryStaffStatus: true,
        assignedDeliveries: {
          where: { status: { in: ["PENDING", "IN_TRANSIT"] } },
          select: { id: true, orderId: true, status: true, deliveryDate: true },
        },
      },
    },
    verifier: { select: { id: true, name: true, email: true } },
  }
}

// Delivery staff: register/update vehicle.
router.post("/", requireAuth, requireRole(["DELIVERY"]), async (req, res, next) => {
  try {
    const parsed = parseBody(vehicleSchema, req, res)
    if (!parsed) return

    const licenseExpiration = parseDate(parsed.license_expiration, "License expiration", res, true)
    if (!licenseExpiration) return

    const data = {
      vehicle_type: parsed.vehicle_type,
      make: parsed.make,
      model: parsed.model,
      year_of_manufacture: parsed.year_of_manufacture,
      license_plate: parsed.license_plate || null,
      vin: parsed.vin || null,
      color: parsed.color,
      driver_contact_number: parsed.driver_contact_number,
      driver_residential_address: parsed.driver_residential_address,
      driver_license_number: parsed.driver_license_number,
      license_expiration: licenseExpiration,
      vehicle_photo: parsed.vehicle_photo,
      driver_photo: parsed.driver_photo,
      registration_document: parsed.registration_document || null,
      is_active: true,
      verification_status: "PENDING",
      verification_notes: null,
      changes_requested: null,
      rejection_reason: null,
      verified_by: null,
      verified_at: null,
    }

    const vehicle = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: req.user.id },
        data: {
          phone: parsed.driver_contact_number,
          deliveryStaffStatus: "PENDING",
        },
      })

      const savedVehicle = await tx.vehicle.upsert({
        where: { user_id: req.user.id },
        update: data,
        create: { ...data, user_id: req.user.id },
        include: includeDriver(),
      })

      return savedVehicle
    })

    res.status(200).json({ message: "Vehicle details submitted successfully", vehicle })
  } catch (error) {
    next(error)
  }
})

// Delivery staff: get own vehicle.
router.get("/me", requireAuth, requireRole(["DELIVERY"]), async (req, res, next) => {
  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { user_id: req.user.id },
      include: includeDriver(),
    })
    res.status(200).json({ vehicle })
  } catch (error) {
    next(error)
  }
})

// Manager/Admin: list vehicles, optionally filtered by verification status.
router.get("/", requireAuth, requireRole(["MANAGER", "ADMIN"]), async (req, res, next) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status.toUpperCase() : undefined
    const where = VERIFICATION_STATUSES.includes(status) ? { verification_status: status } : {}

    const vehicles = await prisma.vehicle.findMany({
      where,
      include: includeDriver(),
      orderBy: { createdAt: "desc" },
    })
    res.status(200).json({ vehicles })
  } catch (error) {
    next(error)
  }
})

// Manager/Admin: update vehicle/security details without forcing driver resubmission.
router.patch("/:id", requireAuth, requireRole(["MANAGER", "ADMIN"]), async (req, res, next) => {
  try {
    const parsed = parseBody(managerUpdateSchema, req, res)
    if (!parsed) return

    const existing = await prisma.vehicle.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ message: "Vehicle not found" })

    const update = {}
    const copyFields = [
      "vehicle_type",
      "make",
      "model",
      "year_of_manufacture",
      "license_plate",
      "vin",
      "color",
      "driver_contact_number",
      "driver_residential_address",
      "driver_license_number",
      "vehicle_photo",
      "driver_photo",
      "registration_document",
      "is_active",
      "verification_notes",
    ]

    copyFields.forEach((field) => {
      if (parsed[field] !== undefined) update[field] = parsed[field]
    })

    if (parsed.license_expiration !== undefined) {
      update.license_expiration = parseDate(parsed.license_expiration, "License expiration", res, true)
      if (!update.license_expiration) return
    }

    const vehicle = await prisma.$transaction(async (tx) => {
      const userUpdate = {}
      if (parsed.driver_contact_number) userUpdate.phone = parsed.driver_contact_number
      if (parsed.is_active === false) userUpdate.deliveryStaffStatus = "SUSPENDED"
      if (parsed.is_active === true && existing.verification_status === "APPROVED") {
        userUpdate.deliveryStaffStatus = "ACTIVE"
      }

      if (Object.keys(userUpdate).length > 0) {
        await tx.user.update({
          where: { id: existing.user_id },
          data: userUpdate,
        })
      }

      const updatedVehicle = await tx.vehicle.update({
        where: { id: existing.id },
        data: update,
        include: includeDriver(),
      })

      if (parsed.is_active === false) {
        await tx.deliveryOrder.updateMany({
          where: {
            driverId: existing.user_id,
            status: { in: ["PENDING", "IN_TRANSIT"] },
          },
          data: { driverId: null, status: "PENDING" },
        })
      }

      return updatedVehicle
    })

    res.status(200).json({ message: "Vehicle details updated", vehicle })
  } catch (error) {
    next(error)
  }
})

// Manager/Admin: remove a driver from active delivery assignment without deleting history.
router.patch("/:id/deactivate", requireAuth, requireRole(["MANAGER", "ADMIN"]), async (req, res, next) => {
  try {
    const parsed = parseBody(deactivateSchema, req, res)
    if (!parsed) return

    const existing = await prisma.vehicle.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ message: "Vehicle not found" })

    const vehicle = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existing.user_id },
        data: { deliveryStaffStatus: "SUSPENDED" },
      })

      const updatedVehicle = await tx.vehicle.update({
        where: { id: existing.id },
        data: {
          is_active: false,
          verification_status: "REJECTED",
          rejection_reason: parsed.reason,
          changes_requested: "Driver removed from active delivery service by management.",
          verified_by: req.user.id,
          verified_at: new Date(),
        },
        include: includeDriver(),
      })

      await tx.deliveryOrder.updateMany({
        where: {
          driverId: existing.user_id,
          status: { in: ["PENDING", "IN_TRANSIT"] },
        },
        data: { driverId: null, status: "PENDING" },
      })

      return updatedVehicle
    })

    await notifyDriver(
      existing.user_id,
      "Delivery access removed",
      `Your delivery access has been removed. Reason: ${parsed.reason}`,
      "VEHICLE_REJECTED",
      { vehicleId: vehicle.id, reason: parsed.reason }
    )

    res.status(200).json({ message: "Driver removed from active delivery service", vehicle })
  } catch (error) {
    next(error)
  }
})

// Manager/Admin: approve or reject a vehicle and notify the driver.
router.patch("/:id/verify", requireAuth, requireRole(["MANAGER", "ADMIN"]), async (req, res, next) => {
  try {
    const parsed = parseBody(verifySchema, req, res)
    if (!parsed) return

    const existing = await prisma.vehicle.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ message: "Vehicle not found" })

    const vehicle = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existing.user_id },
        data: {
          deliveryStaffStatus: parsed.status === "APPROVED" ? "ACTIVE" : "REJECTED",
        },
      })

      const updatedVehicle = await tx.vehicle.update({
        where: { id: existing.id },
        data: {
          is_active: parsed.status === "APPROVED",
          verification_status: parsed.status,
          verification_notes: parsed.notes || null,
          rejection_reason: parsed.status === "REJECTED" ? parsed.rejection_reason : null,
          changes_requested: parsed.status === "REJECTED" ? parsed.changes_requested || null : null,
          verified_by: req.user.id,
          verified_at: new Date(),
        },
        include: includeDriver(),
      })

      if (parsed.status === "REJECTED") {
        await tx.deliveryOrder.updateMany({
          where: {
            driverId: existing.user_id,
            status: { in: ["PENDING", "IN_TRANSIT"] },
          },
          data: { driverId: null, status: "PENDING" },
        })
      }

      return updatedVehicle
    })

    if (parsed.status === "APPROVED") {
      await notifyDriver(
        vehicle.user_id,
        "Vehicle approved",
        "Your vehicle has been approved and your company driver account is now active.",
        "VEHICLE_APPROVED",
        { vehicleId: vehicle.id }
      )
    } else {
      const message = parsed.changes_requested
        ? `${parsed.rejection_reason}. Requested changes: ${parsed.changes_requested}`
        : parsed.rejection_reason
      await notifyDriver(
        vehicle.user_id,
        "Vehicle registration rejected",
        message,
        "VEHICLE_REJECTED",
        { vehicleId: vehicle.id, reason: parsed.rejection_reason }
      )
    }

    res.status(200).json({ message: `Vehicle ${parsed.status.toLowerCase()}`, vehicle })
  } catch (error) {
    next(error)
  }
})

module.exports = router
