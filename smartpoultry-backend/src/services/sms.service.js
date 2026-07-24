const twilio = require("twilio")

const accountSid = process.env.TWILIO_ACCOUNT_SID || "AC_mock_sid"
const authToken = process.env.TWILIO_AUTH_TOKEN || "mock_auth_token"
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER || "+1234567890"

let client = null
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  client = twilio(accountSid, authToken)
}

/**
 * Send an SMS using Twilio.
 * @param {string} to - Recipient phone number (E.164 format, e.g., +233...)
 * @param {string} body - The SMS message text
 */
async function sendSMS(to, body) {
  if (!client) {
    console.warn(`[SMS Service Warning] Twilio not configured. Attempted to send SMS to: ${to}. Mocking output instead.`)
    console.log(`[MOCK SMS to ${to}] Body: ${body}`)
    return
  }

  try {
    const message = await client.messages.create({
      body,
      from: twilioPhoneNumber,
      to,
    })
    console.log(`[SMS Service] Message sent successfully to ${to} (SID: ${message.sid})`)
    return message
  } catch (error) {
    console.error("[SMS Service Error] Failed to send SMS:", error)
    throw error
  }
}

module.exports = {
  sendSMS,
}
