const prisma = require("../config/prisma")

const SMS_PREF_BY_TYPE = {
  PAYMENT_STATUS: "smsPayment",
  ORDER_PLACED: "smsOrderPlaced",
  ORDER_SHIPPED: "smsOrderShipped",
  ORDER_DELIVERED: "smsOrderDelivered",
}

async function sendSms(to, message) {
  const smsUrl = process.env.SMS_API_URL
  const smsKey = process.env.SMS_API_KEY
  const sender = process.env.SMS_SENDER_ID || "SmartPoultry"

  if (!smsUrl || !smsKey || !to || typeof fetch !== "function") {
    return { sent: false, reason: "SMS provider is not configured" }
  }

  try {
    const response = await fetch(smsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${smsKey}`,
      },
      body: JSON.stringify({ to, message, sender }),
    })

    return { sent: response.ok, status: response.status }
  } catch (error) {
    console.error("SMS notification failed:", error.message)
    return { sent: false, reason: error.message }
  }
}

async function createUserNotification({ userId, title, message, type = "INFO", metadata = undefined }) {
  if (!userId) return null

  const notification = await prisma.userNotification.create({
    data: { userId, title, message, type, metadata },
  })

  const smsPreference = SMS_PREF_BY_TYPE[type]
  if (!smsPreference) return notification

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { phone: true, notificationPreferences: true },
  })

  if (user?.phone && user.notificationPreferences?.[smsPreference]) {
    await sendSms(user.phone, message)
  }

  return notification
}

module.exports = {
  createUserNotification,
  sendSms,
}
