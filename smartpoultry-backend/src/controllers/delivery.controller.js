const prisma = require("../config/prisma");

// ─── Status Mappings ──────────────────────────────────────────────────────────

const statusToEnum = {
  Pending: "PENDING",
  "In Transit": "IN_TRANSIT",
  Delivered: "DELIVERED",
  Cancelled: "CANCELLED",
};

const enumToStatus = {
  PENDING: "Pending",
  IN_TRANSIT: "In Transit",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

/** Transform a DB record into the API response shape */
function formatDelivery(d) {
  return {
    id: d.id,
    orderId: d.orderId,
    customer: d.customer,
    product: d.product,
    quantity: d.quantity,
    driver: d.driver,
    deliveryDate: d.deliveryDate,
    address: d.address,
    amount: d.amount,
    notes: d.notes,
    status: enumToStatus[d.status] || d.status,
    statusHistory: d.statusHistory,
    createdAt: d.createdAt,
  };
}

// ─── GET /deliveries?status= ──────────────────────────────────────────────────

const getDeliveries = async (req, res, next) => {
  try {
    const { status } = req.query;

    const where = {};
    if (status && statusToEnum[status]) {
      where.status = statusToEnum[status];
    }

    // Fetch filtered deliveries + counts for all statuses in parallel
    const [deliveries, countGroups] = await Promise.all([
      prisma.deliveryOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
      }),
      prisma.deliveryOrder.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
    ]);

    // Build count map for status summary cards
    const counts = { all: 0, pending: 0, transit: 0, delivered: 0 };
    countGroups.forEach((g) => {
      counts.all += g._count.id;
      if (g.status === "PENDING") counts.pending = g._count.id;
      if (g.status === "IN_TRANSIT") counts.transit = g._count.id;
      if (g.status === "DELIVERED") counts.delivered = g._count.id;
    });

    res.json({
      deliveries: deliveries.map(formatDelivery),
      counts,
    });
  } catch (error) {
    next(error);
  }
};

// ─── POST /deliveries ─────────────────────────────────────────────────────────

const createDelivery = async (req, res, next) => {
  try {
    const { customer, product, quantity, driver, deliveryDate, address, amount, notes } = req.body;

    // Auto-generate order ID: DEL-YYYY-NNN
    const year = new Date().getFullYear();
    const prefix = `DEL-${year}-`;

    const latestOrder = await prisma.deliveryOrder.findFirst({
      where: { orderId: { startsWith: prefix } },
      orderBy: { orderId: "desc" },
    });

    let nextNum = 1;
    if (latestOrder) {
      const lastNum = parseInt(latestOrder.orderId.split("-").pop(), 10);
      nextNum = lastNum + 1;
    }

    const orderId = `${prefix}${String(nextNum).padStart(3, "0")}`;

    const delivery = await prisma.deliveryOrder.create({
      data: {
        orderId,
        customer,
        product,
        quantity,
        driver: driver || "Unassigned",
        deliveryDate: new Date(deliveryDate),
        address: address || null,
        amount,
        notes: notes || null,
        status: "PENDING",
        statusHistory: [{ status: "Pending", timestamp: new Date().toISOString() }],
      },
    });

    res.status(201).json({ delivery: formatDelivery(delivery) });
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /deliveries/:id/status ─────────────────────────────────────────────

const updateDeliveryStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const enumStatus = statusToEnum[status];
    if (!enumStatus) {
      return res.status(400).json({ error: `Invalid status: ${status}` });
    }

    // Support lookup by cuid or orderId
    const existing = await prisma.deliveryOrder.findFirst({
      where: { OR: [{ id }, { orderId: id }] },
    });

    if (!existing) {
      return res.status(404).json({ error: "Delivery not found" });
    }

    // Append to status history with timestamp
    const history = Array.isArray(existing.statusHistory) ? [...existing.statusHistory] : [];
    history.push({ status, timestamp: new Date().toISOString() });

    const updated = await prisma.deliveryOrder.update({
      where: { id: existing.id },
      data: { status: enumStatus, statusHistory: history },
    });

    res.json({ delivery: formatDelivery(updated) });
  } catch (error) {
    next(error);
  }
};

// ─── GET /deliveries/revenue ──────────────────────────────────────────────────

const getDeliveryRevenue = async (req, res, next) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [todayAgg, pendingAgg, monthAgg] = await Promise.all([
      // Today's delivered revenue
      prisma.deliveryOrder.aggregate({
        where: {
          status: "DELIVERED",
          deliveryDate: { gte: todayStart, lt: todayEnd },
        },
        _sum: { amount: true },
      }),
      // Pending collection total
      prisma.deliveryOrder.aggregate({
        where: { status: "PENDING" },
        _sum: { amount: true },
      }),
      // Month total (delivered)
      prisma.deliveryOrder.aggregate({
        where: {
          status: "DELIVERED",
          deliveryDate: { gte: monthStart, lt: monthEnd },
        },
        _sum: { amount: true },
      }),
    ]);

    res.json({
      todayTotal: todayAgg._sum.amount || 0,
      pendingTotal: pendingAgg._sum.amount || 0,
      monthTotal: monthAgg._sum.amount || 0,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDeliveries, createDelivery, updateDeliveryStatus, getDeliveryRevenue };
