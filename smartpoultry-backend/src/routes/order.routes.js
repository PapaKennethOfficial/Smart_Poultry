const express = require("express")
const crypto = require("crypto")
const { z } = require("zod")
const router = express.Router()
const prisma = require("../config/prisma")
const { requireAuth, requireRole } = require("../middleware/auth")
const { createUserNotification } = require("../services/notification.service")
const {
  createAssignmentHistory,
  findEligibleDriver,
  selectAvailableDriver,
} = require("../services/deliveryAssignment.service")
const { buildDeliveryOrderWhere } = require("../utils/deliveryFilters")

const STATUS_VALUES = ["PENDING", "IN_TRANSIT", "DELIVERED", "CANCELLED"]
const PAYMENT_METHODS = ["MOBILE_MONEY", "PAY_ON_DELIVERY"]
const PAYMENT_LABELS = {
  MOBILE_MONEY: "Mobile Money",
  PAY_ON_DELIVERY: "Payment on Delivery",
}

const STATUS_NOTIFICATION = {
  PENDING: { title: "Order placed", type: "ORDER_PLACED", label: "pending review" },
  IN_TRANSIT: { title: "Order shipped", type: "ORDER_SHIPPED", label: "on the way" },
  DELIVERED: { title: "Order delivered", type: "ORDER_DELIVERED", label: "delivered" },
  CANCELLED: { title: "Order cancelled", type: "ORDER_STATUS", label: "cancelled" },
}

const createOrderSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  quantity: z.coerce.number().int().positive("Quantity must be positive"),
  deliveryDate: z.string().min(1, "Delivery date is required"),
  address: z.string().trim().min(5, "Delivery address is required"),
  contactNumber: z.string().trim().min(7, "Contact number is required"),
  notes: z.string().trim().optional().default(""),
  paymentMethod: z.enum(PAYMENT_METHODS).default("PAY_ON_DELIVERY"),
  deliveryLatitude: z.coerce.number().min(-90).max(90).optional(),
  deliveryLongitude: z.coerce.number().min(-180).max(180).optional(),
})

const updateOrderSchema = z.object({
  status: z.enum(STATUS_VALUES).optional(),
  driverId: z.string().min(1).nullable().optional(),
}).refine((data) => data.status !== undefined || data.driverId !== undefined, {
  message: "status or driverId is required",
})

const updateLocationSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
})

const messageSchema = z.object({
  message: z.string().trim().min(1, "Message is required").max(1000, "Message is too long"),
})

function parseBody(schema, req, res) {
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors })
    return null
  }
  return parsed.data
}

function publicUserSelect() {
  return { id: true, name: true, email: true, phone: true, role: true, deliveryStaffStatus: true }
}

function orderInclude() {
  return {
    product: true,
    customer: { select: publicUserSelect() },
    driver: {
      select: {
        ...publicUserSelect(),
        vehicle: {
          select: {
            id: true,
            make: true,
            model: true,
            license_plate: true,
            color: true,
            vehicle_type: true,
            vehicle_photo: true,
            driver_photo: true,
            driver_contact_number: true,
            verification_status: true,
          },
        },
      },
    },
  }
}

async function createNotification(userId, title, message, type = "INFO", metadata = undefined) {
  await createUserNotification({ userId, title, message, type, metadata })
}

async function assertOrderAccess(orderId, user) {
  const order = await prisma.deliveryOrder.findUnique({
    where: { id: orderId },
    include: orderInclude(),
  })

  if (!order) {
    const err = new Error("Order not found")
    err.status = 404
    throw err
  }

  const isManager = user.role === "ADMIN" || user.role === "MANAGER"
  const isCustomer = order.customerId === user.id
  const isAssignedDriver = order.driverId === user.id

  if (!isManager && !isCustomer && !isAssignedDriver) {
    const err = new Error("Forbidden")
    err.status = 403
    throw err
  }

  return order
}

async function generateOrderId() {
  const year = new Date().getFullYear()
  for (let i = 0; i < 5; i++) {
    const suffix = `${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`
    const orderId = `DEL-${year}-${suffix}`
    const existing = await prisma.deliveryOrder.findUnique({ where: { orderId } })
    if (!existing) return orderId
  }
  return `DEL-${year}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
}

// Customer: place an order
router.post("/", requireAuth, requireRole(["CUSTOMER"]), async (req, res, next) => {
  try {
    const data = parseBody(createOrderSchema, req, res)
    if (!data) return

    const product = await prisma.product.findUnique({ where: { id: data.productId } })
    if (!product) return res.status(404).json({ message: "Product not found" })
    if (product.stock < data.quantity) {
      return res.status(400).json({ message: "Requested quantity exceeds available stock" })
    }

    const deliveryDate = new Date(data.deliveryDate)
    if (Number.isNaN(deliveryDate.getTime())) {
      return res.status(400).json({ message: "Invalid delivery date" })
    }

    const orderId = await generateOrderId()
    const amount = product.price * data.quantity
    let assignedDriver = null

    const order = await prisma.$transaction(async (tx) => {
      assignedDriver = await selectAvailableDriver({
        db: tx,
        deliveryLatitude: data.deliveryLatitude,
        deliveryLongitude: data.deliveryLongitude,
      })

      const statusHistory = [{ status: "PENDING", timestamp: new Date().toISOString() }]
      const assignmentHistory = createAssignmentHistory(assignedDriver, "AUTO")
      if (assignmentHistory) statusHistory.push(assignmentHistory)

      const created = await tx.deliveryOrder.create({
        data: {
          orderId,
          customerId: req.user.id,
          productId: data.productId,
          quantity: data.quantity,
          driverId: assignedDriver?.id || null,
          deliveryDate,
          address: data.address,
          contactNumber: data.contactNumber,
          amount,
          paymentMethod: data.paymentMethod,
          paymentStatus: data.paymentMethod === "PAY_ON_DELIVERY" ? "PENDING" : "AWAITING_CONFIRMATION",
          notes: data.notes || null,
          deliveryLatitude: data.deliveryLatitude,
          deliveryLongitude: data.deliveryLongitude,
          status: "PENDING",
          statusHistory,
        },
        include: orderInclude(),
      })

      await tx.product.update({
        where: { id: data.productId },
        data: { stock: { decrement: data.quantity } },
      })

      return created
    })

    const notifications = [
      createNotification(
        req.user.id,
        "Order placed",
        `Your order ${order.orderId} has been received.`,
        "ORDER_PLACED",
        { orderId: order.id }
      ),
      createNotification(
        req.user.id,
        "Payment status",
        `${PAYMENT_LABELS[data.paymentMethod]} selected for order ${order.orderId}.`,
        "PAYMENT_STATUS",
        { orderId: order.id, paymentMethod: data.paymentMethod, paymentStatus: order.paymentStatus }
      ),
    ]

    if (assignedDriver) {
      notifications.push(
        createNotification(
          assignedDriver.id,
          "New delivery assigned",
          `You have been assigned order ${order.orderId}.`,
          "DELIVERY_ASSIGNED",
          { orderId: order.id }
        )
      )
    }

    await Promise.all(notifications)

    // ─── Automated Low-Stock & Out-of-Stock Alerts ───────────────────────────
    const updatedProduct = await prisma.product.findUnique({ where: { id: data.productId } })
    if (updatedProduct) {
      const LOW_STOCK_THRESHOLD = 5

      // Auto-unlist product if stock has reached zero
      if (updatedProduct.stock <= 0) {
        await prisma.product.update({
          where: { id: data.productId },
          data: { isActive: false }
        })
      }

      // Notify all managers about low or out-of-stock
      if (updatedProduct.stock <= LOW_STOCK_THRESHOLD) {
        const managers = await prisma.user.findMany({
          where: { role: { in: ["MANAGER", "ADMIN"] } },
          select: { id: true }
        })

        const stockMessage = updatedProduct.stock <= 0
          ? `"${updatedProduct.name}" is now OUT OF STOCK and has been automatically unlisted from the marketplace.`
          : `"${updatedProduct.name}" is running low — only ${updatedProduct.stock} ${updatedProduct.unit}(s) remaining. Consider restocking soon.`

        const stockAlerts = managers.map((m) =>
          createNotification(
            m.id,
            updatedProduct.stock <= 0 ? "Product out of stock" : "Low stock alert",
            stockMessage,
            "LOW_STOCK",
            { productId: data.productId, currentStock: updatedProduct.stock }
          )
        )
        await Promise.all(stockAlerts)
      }
    }

    res.status(201).json({ message: "Order placed successfully", order })
  } catch (error) {
    next(error)
  }
})

// Customer: view their own orders
router.get("/me", requireAuth, requireRole(["CUSTOMER"]), async (req, res, next) => {
  try {
    const { customerId: _customerId, driverId: _driverId, ...filters } = req.query
    const orders = await prisma.deliveryOrder.findMany({
      where: buildDeliveryOrderWhere(filters, { customerId: req.user.id }),
      include: orderInclude(),
      orderBy: { createdAt: "desc" },
    })
    res.status(200).json({ orders })
  } catch (error) {
    next(error)
  }
})

// Delivery staff: view assigned orders
router.get("/assigned", requireAuth, requireRole(["DELIVERY"]), async (req, res, next) => {
  try {
    const { customerId: _customerId, driverId: _driverId, ...filters } = req.query
    const orders = await prisma.deliveryOrder.findMany({
      where: buildDeliveryOrderWhere(filters, { driverId: req.user.id }),
      include: orderInclude(),
      orderBy: { deliveryDate: "asc" },
    })
    res.status(200).json({ orders })
  } catch (error) {
    next(error)
  }
})

// Manager/Admin: view all orders
router.get("/", requireAuth, requireRole(["MANAGER", "ADMIN"]), async (req, res, next) => {
  try {
    const orders = await prisma.deliveryOrder.findMany({
      where: buildDeliveryOrderWhere(req.query),
      include: orderInclude(),
      orderBy: { createdAt: "desc" },
    })
    res.status(200).json({ orders })
  } catch (error) {
    next(error)
  }
})

// Manager: assign driver/update status. Delivery staff: update own assigned status only.
router.patch("/:id", requireAuth, requireRole(["MANAGER", "ADMIN", "DELIVERY"]), async (req, res, next) => {
  try {
    const data = parseBody(updateOrderSchema, req, res)
    if (!data) return

    const existingOrder = await prisma.deliveryOrder.findUnique({
      where: { id: req.params.id },
      include: orderInclude(),
    })
    if (!existingOrder) return res.status(404).json({ message: "Order not found" })

    if (req.user.role === "DELIVERY") {
      if (data.driverId !== undefined) {
        return res.status(403).json({ message: "Delivery staff cannot assign drivers" })
      }
      if (existingOrder.driverId !== req.user.id) {
        return res.status(403).json({ message: "You can only update orders assigned to you" })
      }
    }

    let assignedDriver = null
    let assignmentSource = null

    if (data.status === "IN_TRANSIT" && data.driverId === null) {
      return res.status(400).json({ message: "An in-transit order must have an assigned driver" })
    }

    if (data.driverId === null && existingOrder.status === "IN_TRANSIT" && data.status !== "CANCELLED") {
      return res.status(400).json({ message: "Move the order out of transit before unassigning the driver" })
    }

    if (data.driverId && data.driverId !== existingOrder.driverId) {
      assignedDriver = await findEligibleDriver(data.driverId)
      assignmentSource = "MANUAL"

      if (!assignedDriver) {
        return res.status(400).json({
          message: "Select an active company driver with an approved active vehicle and no active delivery",
        })
      }
    }

    if (
      data.driverId === undefined &&
      data.status === "IN_TRANSIT" &&
      !existingOrder.driverId
    ) {
      assignedDriver = await selectAvailableDriver({
        deliveryLatitude: existingOrder.deliveryLatitude,
        deliveryLongitude: existingOrder.deliveryLongitude,
      })
      assignmentSource = "AUTO_DISPATCH"

      if (!assignedDriver) {
        return res.status(400).json({
          message: "No active company driver is currently available for this order",
        })
      }
    }

    const statusHistory = Array.isArray(existingOrder.statusHistory)
      ? [...existingOrder.statusHistory]
      : []

    const update = {}
    const assignmentHistory = createAssignmentHistory(assignedDriver, assignmentSource)
    if (assignmentHistory) statusHistory.push(assignmentHistory)

    if (data.status && data.status !== existingOrder.status) {
      update.status = data.status
      statusHistory.push({ status: data.status, timestamp: new Date().toISOString(), by: req.user.id })
    }
    if (data.driverId !== undefined) update.driverId = data.driverId
    if (assignedDriver && data.driverId === undefined) update.driverId = assignedDriver.id
    update.statusHistory = statusHistory

    const order = await prisma.deliveryOrder.update({
      where: { id: existingOrder.id },
      data: update,
      include: orderInclude(),
    })

    if (assignedDriver && assignedDriver.id !== existingOrder.driverId) {
      await createNotification(
        assignedDriver.id,
        "New delivery assigned",
        `You have been assigned order ${order.orderId}.`,
        "DELIVERY_ASSIGNED",
        { orderId: order.id }
      )
    }

    if (data.status && data.status !== existingOrder.status) {
      const notification = STATUS_NOTIFICATION[data.status] || STATUS_NOTIFICATION.PENDING
      await createNotification(
        order.customerId,
        notification.title,
        `Your order ${order.orderId} is ${notification.label}.`,
        notification.type,
        { orderId: order.id, status: data.status }
      )
    }

    res.status(200).json({ message: "Order updated", order })
  } catch (error) {
    next(error)
  }
})

// Delivery staff: update live location for an assigned order.
router.patch("/:id/location", requireAuth, requireRole(["DELIVERY"]), async (req, res, next) => {
  try {
    const data = parseBody(updateLocationSchema, req, res)
    if (!data) return

    const existingOrder = await prisma.deliveryOrder.findUnique({ where: { id: req.params.id } })
    if (!existingOrder) return res.status(404).json({ message: "Order not found" })
    if (existingOrder.driverId !== req.user.id) {
      return res.status(403).json({ message: "You can only update your assigned deliveries" })
    }

    const order = await prisma.deliveryOrder.update({
      where: { id: existingOrder.id },
      data: {
        driverLatitude: data.latitude,
        driverLongitude: data.longitude,
        driverLocationUpdatedAt: new Date(),
      },
      include: orderInclude(),
    })

    res.status(200).json({ order })
  } catch (error) {
    next(error)
  }
})

router.get("/:id/messages", requireAuth, async (req, res, next) => {
  try {
    await assertOrderAccess(req.params.id, req.user)

    const messages = await prisma.deliveryMessage.findMany({
      where: { orderId: req.params.id },
      orderBy: { createdAt: "asc" },
      include: { sender: { select: publicUserSelect() } },
    })

    res.status(200).json({ messages })
  } catch (error) {
    next(error)
  }
})

router.post("/:id/messages", requireAuth, async (req, res, next) => {
  try {
    const data = parseBody(messageSchema, req, res)
    if (!data) return

    const order = await assertOrderAccess(req.params.id, req.user)

    const created = await prisma.deliveryMessage.create({
      data: {
        orderId: order.id,
        senderId: req.user.id,
        message: data.message,
      },
      include: { sender: { select: publicUserSelect() } },
    })

    const recipientId =
      req.user.id === order.customerId ? order.driverId : order.customerId
    if (recipientId) {
      await createNotification(
        recipientId,
        `New message for ${order.orderId}`,
        data.message.length > 120 ? `${data.message.slice(0, 120)}...` : data.message,
        "ORDER_CHAT",
        { orderId: order.id }
      )
    }

    res.status(201).json({ message: created })
  } catch (error) {
    next(error)
  }
})

module.exports = router
