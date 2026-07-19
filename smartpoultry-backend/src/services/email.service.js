const nodemailer = require("nodemailer")

// This uses a generic SMTP transport.
// In a real production setup, configure these env vars with your actual email provider (e.g. SendGrid, Mailgun, or standard SMTP)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.example.com",
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || "user@example.com",
    pass: process.env.SMTP_PASS || "password123",
  },
})

/**
 * Send an email using the configured SMTP server.
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - HTML content of the email
 */
async function sendEmail(to, subject, html) {
  // If SMTP is not fully configured, log a warning and skip to prevent crashing
  if (!process.env.SMTP_USER || process.env.SMTP_USER === "user@example.com") {
    console.warn(`[Email Service Warning] SMTP not configured. Attempted to send email to: ${to}. Mocking output instead.`)
    console.log(`[MOCK EMAIL to ${to}] Subject: ${subject}\nBody: ${html}`)
    return
  }

  try {
    const info = await transporter.sendMail({
      from: `"SmartPoultry System" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    })
    console.log(`[Email Service] Message sent successfully to ${to} (${info.messageId})`)
    return info
  } catch (error) {
    console.error("[Email Service Error] Failed to send email:", error)
    throw error
  }
}

module.exports = {
  sendEmail,
}
