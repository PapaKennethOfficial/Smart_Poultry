const prisma = require("../config/prisma");

/**
 * auditLog — Automatic audit trail middleware
 *
 * Logs every mutating request (POST, PUT, PATCH, DELETE) to the AuditLog table
 * after the response has been sent. Runs asynchronously so it never blocks the response.
 *
 * Requires: authenticate middleware to have set req.user upstream on the route.
 */
function auditLog(req, res, next) {
  const AUDITED_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

  if (!AUDITED_METHODS.includes(req.method)) {
    return next();
  }

  // Register listener that fires AFTER the response is fully sent
  res.on("finish", async () => {
    // Skip if no authenticated user (e.g. login/register routes)
    if (!req.user?.id) return;

    try {
      // Derive entity name from the URL: /api/deliveries/123 → "deliveries"
      const segments = req.originalUrl.split("/").filter(Boolean);
      const entity = segments[1] || "unknown"; // segments[0] = "api"

      await prisma.auditLog.create({
        data: {
          userId:   req.user.id,
          action:   `${req.method} ${req.route?.path || req.path}`,
          endpoint: req.originalUrl,
          entity,
          entityId: req.params?.id || null,
          details:  req.body && Object.keys(req.body).length > 0 ? req.body : undefined,
        },
      });
    } catch (err) {
      // Never let audit failures crash the app — log and move on
      console.error("[AuditLog] Failed to write audit entry:", err.message);
    }
  });

  next();
}

module.exports = auditLog;
