const express = require("express")
const router = express.Router()
const { z } = require("zod")
const prisma = require("../config/prisma")
const { requireAuth, requireRole } = require("../middleware/auth")

// Schema for requesting a withdrawal
const createWithdrawalSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  notes: z.string().trim().optional(),
})

// Schema for updating withdrawal status
const updateWithdrawalSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "PAID"]),
})

// Helper to calculate available balance
async function calculateAvailableBalance(driverId) {
  // 1. Calculate owed by company (unpaid deliveries)
  const unpaidOrders = await prisma.deliveryOrder.findMany({
    where: {
      driverId,
      status: "DELIVERED",
      paymentMethod: { not: "PAY_ON_DELIVERY" },
      driverPayoutStatus: { not: "PAID_OUT" },
    },
    select: { deliveryFee: true },
  })

  const owedByCompany = unpaidOrders.reduce((sum, order) => sum + (order.deliveryFee || 0), 0)

  // 2. Calculate pending withdrawals
  const pendingWithdrawals = await prisma.withdrawalRequest.findMany({
    where: {
      driverId,
      status: { in: ["PENDING", "APPROVED"] }, // APPROVED means it's about to be PAID but not yet reconciled
    },
    select: { amount: true },
  })

  const pendingAmount = pendingWithdrawals.reduce((sum, w) => sum + w.amount, 0)

  return owedByCompany - pendingAmount
}

// POST /api/withdrawals - Driver requests withdrawal
router.post("/", requireAuth, requireRole(["DELIVERY"]), async (req, res, next) => {
  try {
    const parsed = createWithdrawalSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ errors: parsed.error.flatten().fieldErrors })
    }

    const { amount, notes } = parsed.data

    const availableBalance = await calculateAvailableBalance(req.user.id)
    if (amount > availableBalance) {
      return res.status(400).json({ 
        message: `Requested amount (GHS ${amount}) exceeds your available balance (GHS ${availableBalance})` 
      })
    }

    const withdrawal = await prisma.withdrawalRequest.create({
      data: {
        driverId: req.user.id,
        amount,
        notes,
        status: "PENDING",
      }
    })

    res.status(201).json({ message: "Withdrawal requested successfully", withdrawal })
  } catch (error) {
    next(error)
  }
})

// GET /api/withdrawals/me - Driver views their history
router.get("/me", requireAuth, requireRole(["DELIVERY"]), async (req, res, next) => {
  try {
    const withdrawals = await prisma.withdrawalRequest.findMany({
      where: { driverId: req.user.id },
      orderBy: { createdAt: "desc" },
    })

    const availableBalance = await calculateAvailableBalance(req.user.id)

    res.status(200).json({ withdrawals, availableBalance })
  } catch (error) {
    next(error)
  }
})

// GET /api/withdrawals - Admin views all withdrawals
router.get("/", requireAuth, requireRole(["ADMIN", "MANAGER"]), async (req, res, next) => {
  try {
    const withdrawals = await prisma.withdrawalRequest.findMany({
      include: {
        driver: {
          select: { id: true, name: true, phone: true }
        }
      },
      orderBy: [
        { status: "asc" },
        { createdAt: "desc" },
      ],
    })

    res.status(200).json({ withdrawals })
  } catch (error) {
    next(error)
  }
})

// PATCH /api/withdrawals/:id/status - Admin processes withdrawal
router.patch("/:id/status", requireAuth, requireRole(["ADMIN", "MANAGER"]), async (req, res, next) => {
  try {
    const { id } = req.params
    const parsed = updateWithdrawalSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ errors: parsed.error.flatten().fieldErrors })
    }

    const { status } = parsed.data

    const withdrawal = await prisma.withdrawalRequest.findUnique({
      where: { id },
      include: { driver: true }
    })

    if (!withdrawal) {
      return res.status(404).json({ message: "Withdrawal request not found" })
    }

    if (withdrawal.status === "PAID" || withdrawal.status === "REJECTED") {
      return res.status(400).json({ message: `Cannot update a withdrawal that is already ${withdrawal.status}` })
    }

    // Auto-reconciliation logic
    if (status === "PAID") {
      await prisma.$transaction(async (tx) => {
        // Find oldest unpaid deliveries
        const unpaidOrders = await tx.deliveryOrder.findMany({
          where: {
            driverId: withdrawal.driverId,
            status: "DELIVERED",
            paymentMethod: { not: "PAY_ON_DELIVERY" },
            driverPayoutStatus: { not: "PAID_OUT" },
          },
          orderBy: { deliveryDate: "asc" },
        })

        let remainingAmount = withdrawal.amount
        const ordersToMarkPaid = []

        for (const order of unpaidOrders) {
          if (remainingAmount <= 0) break
          const fee = order.deliveryFee || 0
          if (fee > 0) {
            ordersToMarkPaid.push(order.id)
            remainingAmount -= fee
          }
        }

        // Mark withdrawal as PAID
        await tx.withdrawalRequest.update({
          where: { id },
          data: { status: "PAID", processedAt: new Date() },
        })

        // Mark those orders as PAID_OUT
        if (ordersToMarkPaid.length > 0) {
          await tx.deliveryOrder.updateMany({
            where: { id: { in: ordersToMarkPaid } },
            data: { driverPayoutStatus: "PAID_OUT" },
          })
        }
      })
    } else {
      // Just update status (e.g. APPROVED or REJECTED)
      await prisma.withdrawalRequest.update({
        where: { id },
        data: { status, processedAt: new Date() },
      })
    }

    res.status(200).json({ message: `Withdrawal marked as ${status}` })
  } catch (error) {
    next(error)
  }
})

module.exports = router
