const prisma = require("../config/prisma");

// ─── GET /alerts ─────────────────────────────────────────────────────────────
// Returns all unresolved (i.e. "unread") alerts ordered by newest first.
// The Alert model in schema.prisma uses `isResolved` as the closest analogue
// to "read/unread" state — once an admin marks an alert resolved it drops out
// of this feed.
const listAlerts = async (req, res, next) => {
  try {
    const alerts = await prisma.alert.findMany({
      where: { isResolved: false },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        message: true,
        severity: true,
        createdAt: true,
        farmId: true,
        batchId: true,
      },
    });

    res.status(200).json(alerts);
  } catch (error) {
    next(error);
  }
};

module.exports = { listAlerts };
