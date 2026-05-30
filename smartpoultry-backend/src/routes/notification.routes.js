const express = require("express")
const router = express.Router()
const prisma = require("../config/prisma")
const { requireAuth } = require("../middleware/auth")

router.use(requireAuth)

router.get("/", async (req, res, next) => {
  try {
    const notifications = await prisma.userNotification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    })

    const unreadCount = notifications.filter((n) => !n.isRead).length
    res.status(200).json({ notifications, unreadCount })
  } catch (error) {
    next(error)
  }
})

router.patch("/:id/read", async (req, res, next) => {
  try {
    const notification = await prisma.userNotification.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    })

    if (!notification) return res.status(404).json({ message: "Notification not found" })

    const updated = await prisma.userNotification.update({
      where: { id: notification.id },
      data: { isRead: true },
    })

    res.status(200).json({ notification: updated })
  } catch (error) {
    next(error)
  }
})

router.patch("/read-all", async (req, res, next) => {
  try {
    await prisma.userNotification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    })

    res.status(200).json({ message: "Notifications marked as read" })
  } catch (error) {
    next(error)
  }
})

module.exports = router
