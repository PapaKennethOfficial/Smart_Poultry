const prisma = require("../config/prisma");
const { createUserNotification } = require("../services/notification.service");
const {
  createAssignmentHistory,
  eligibleDriverWhere,
  findEligibleDriver,
  selectAvailableDriver,
} = require("../services/deliveryAssignment.service");
const {
  buildCountWhere,
  buildDeliveryOrderWhere,
} = require("../utils/deliveryFilters");

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
    customer: d.customer?.name || d.customer,
    product: d.product?.name || d.product,
    quantity: d.quantity,
    driver: d.driver?.name || d.driver || "Unassigned",
    customerDetails: d.customer || null,
    productDetails: d.product || null,
    driverDetails: d.driver || null,
    deliveryDate: d.deliveryDate,
    address: d.address,
    amount: d.amount,
    contactNumber: d.contactNumber,
    paymentMethod: d.paymentMethod,
    paymentStatus: d.paymentStatus,
    notes: d.notes,
    status: enumToStatus[d.status] || d.status,
    statusHistory: d.statusHistory,
    deliveryLatitude: d.deliveryLatitude,
    deliveryLongitude: d.deliveryLongitude,
    driverLatitude: d.driverLatitude,
    driverLongitude: d.driverLongitude,
    driverLocationUpdatedAt: d.driverLocationUpdatedAt,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

function driverSelect() {
  return {
    id: true,
    name: true,
    email: true,
    phone: true,
    role: true,
    deliveryStaffStatus: true,
    vehicle: {
      select: {
        id: true,
        make: true,
        model: true,
        vehicle_type: true,
        license_plate: true,
        vehicle_photo: true,
        driver_photo: true,
        driver_contact_number: true,
        driver_residential_address: true,
        is_active: true,
        verification_status: true,
      },
    },
    assignedDeliveries: {
      where: { status: { in: ["PENDING", "IN_TRANSIT"] } },
      select: { id: true, orderId: true, status: true, deliveryDate: true },
    },
  };
}

const getAvailableDrivers = async (req, res, next) => {
  try {
    const drivers = await prisma.user.findMany({
      where: eligibleDriverWhere(),
      select: driverSelect(),
      orderBy: { name: "asc" },
    });

    res.json({ drivers });
  } catch (error) {
    next(error);
  }
};

// ─── GET /deliveries?status= ──────────────────────────────────────────────────

const getDeliveries = async (req, res, next) => {
  try {
    const where = buildDeliveryOrderWhere(req.query);
    const countWhere = buildCountWhere(where);

    // Fetch filtered deliveries + counts for all statuses in parallel
    const [deliveries, countGroups] = await Promise.all([
      prisma.deliveryOrder.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, email: true, phone: true } },
          product: true,
          driver: { select: driverSelect() },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.deliveryOrder.groupBy({
        by: ["status"],
        where: countWhere,
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
    const {
      customer,
      customerId,
      product,
      productId,
      quantity,
      driverId,
      deliveryDate,
      address,
      amount,
      notes,
      deliveryLatitude,
      deliveryLongitude,
    } = req.body;

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

    let resolvedCustomerId = customerId;
    if (!resolvedCustomerId) {
      // Legacy manager-created deliveries used a free-text customer name.
      // Preserve compatibility by creating a non-login customer shell.
      const safeName = (customer || "Walk-in Customer").trim();
      const emailSlug = safeName.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "") || "customer";
      const createdCustomer = await prisma.user.create({
        data: {
          name: safeName,
          email: `${emailSlug}.${Date.now()}@placeholder.smartpoultry.local`,
          password: "",
          role: "CUSTOMER",
        },
      });
      resolvedCustomerId = createdCustomer.id;
    }

    let resolvedProductId = productId;
    if (!resolvedProductId) {
      const productName = (product || "Farm product").trim();
      const existingProduct = await prisma.product.findFirst({ where: { name: productName } });
      if (existingProduct) {
        resolvedProductId = existingProduct.id;
      } else {
        const createdProduct = await prisma.product.create({
          data: {
            name: productName,
            price: quantity > 0 ? amount / quantity : amount,
            unit: "item",
            stock: 0,
          },
        });
        resolvedProductId = createdProduct.id;
      }
    }

    let assignedDriver = null;
    if (driverId) {
      assignedDriver = await findEligibleDriver(driverId);
      if (!assignedDriver) {
        return res.status(400).json({
          error: "Selected driver must be an active company driver with an approved active vehicle and no active delivery",
        });
      }
    } else {
      assignedDriver = await selectAvailableDriver({ deliveryLatitude, deliveryLongitude });
    }

    const statusHistory = [{ status: "Pending", timestamp: new Date().toISOString() }];
    const assignmentHistory = createAssignmentHistory(assignedDriver, driverId ? "MANUAL" : "AUTO");
    if (assignmentHistory) statusHistory.push(assignmentHistory);

    const delivery = await prisma.deliveryOrder.create({
      data: {
        orderId,
        customerId: resolvedCustomerId,
        productId: resolvedProductId,
        quantity,
        driverId: assignedDriver?.id || null,
        deliveryDate: new Date(deliveryDate),
        address: address || null,
        amount,
        paymentMethod: "PAY_ON_DELIVERY",
        paymentStatus: "PENDING",
        notes: notes || null,
        status: "PENDING",
        statusHistory,
        deliveryLatitude,
        deliveryLongitude,
      },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        product: true,
        driver: { select: driverSelect() },
      },
    });

    if (assignedDriver) {
      await createUserNotification({
        userId: assignedDriver.id,
        title: "New delivery assigned",
        message: `You have been assigned delivery ${delivery.orderId}.`,
        type: "DELIVERY_ASSIGNED",
        metadata: { orderId: delivery.id },
      });
    }

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
    let assignedDriver = null;

    if (enumStatus === "IN_TRANSIT" && !existing.driverId) {
      assignedDriver = await selectAvailableDriver({
        deliveryLatitude: existing.deliveryLatitude,
        deliveryLongitude: existing.deliveryLongitude,
      });

      if (!assignedDriver) {
        return res.status(400).json({
          error: "No active company driver is currently available for this delivery",
        });
      }

      history.push(createAssignmentHistory(assignedDriver, "AUTO_DISPATCH"));
    }

    history.push({ status, timestamp: new Date().toISOString() });

    const updated = await prisma.deliveryOrder.update({
      where: { id: existing.id },
      data: {
        status: enumStatus,
        statusHistory: history,
        ...(assignedDriver ? { driverId: assignedDriver.id } : {}),
      },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        product: true,
        driver: { select: driverSelect() },
      },
    });

    if (assignedDriver) {
      await createUserNotification({
        userId: assignedDriver.id,
        title: "New delivery assigned",
        message: `You have been assigned delivery ${updated.orderId}.`,
        type: "DELIVERY_ASSIGNED",
        metadata: { orderId: updated.id },
      });
    }

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

module.exports = { getDeliveries, getAvailableDrivers, createDelivery, updateDeliveryStatus, getDeliveryRevenue };
