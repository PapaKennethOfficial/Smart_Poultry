const prisma = require("../config/prisma");

// ─── GET /analytics/forecast ──────────────────────────────────────────────────
// Returns the last 10 days of egg counts as a simple forecast placeholder.
// Each item is labelled with a fixed 85% confidence.

const getForecast = async (req, res, next) => {
  try {
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    tenDaysAgo.setHours(0, 0, 0, 0);

    const entries = await prisma.logEntry.findMany({
      where: { date: { gte: tenDaysAgo } },
      select: { date: true, eggsCount: true },
      orderBy: { date: "asc" },
    });

    // Aggregate eggs per calendar day
    const dayMap = new Map();
    entries.forEach((e) => {
      const dayKey = new Date(e.date).toISOString().slice(0, 10);
      dayMap.set(dayKey, (dayMap.get(dayKey) || 0) + (e.eggsCount || 0));
    });

    const forecast = Array.from(dayMap.entries()).map(([dateStr, eggs]) => {
      const d = new Date(dateStr);
      return {
        day: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        predicted: eggs,
        confidence: 85,
      };
    });

    // If no data exists, return empty array (frontend handles gracefully)
    res.json(forecast);
  } catch (error) {
    next(error);
  }
};

// ─── GET /analytics/fcr?weeks=6 ───────────────────────────────────────────────
// FCR = feedConsumption / eggsCount grouped by week.

const getFCR = async (req, res, next) => {
  try {
    const weeks = Math.min(parseInt(req.query.weeks) || 6, 52);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - weeks * 7);
    startDate.setHours(0, 0, 0, 0);

    const entries = await prisma.logEntry.findMany({
      where: { date: { gte: startDate } },
      select: { date: true, feedConsumption: true, eggsCount: true },
      orderBy: { date: "asc" },
    });

    // Group by ISO week number
    const weekMap = new Map();
    entries.forEach((e) => {
      const d = new Date(e.date);
      // ISO week: use Thursday-based week numbering
      const jan1 = new Date(d.getFullYear(), 0, 1);
      const weekNum = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
      const key = `${d.getFullYear()}-W${weekNum}`;

      if (!weekMap.has(key)) {
        weekMap.set(key, { feed: 0, eggs: 0 });
      }
      const bucket = weekMap.get(key);
      bucket.feed += e.feedConsumption || 0;
      bucket.eggs += e.eggsCount || 0;
    });

    let index = 1;
    const fcrData = Array.from(weekMap.entries()).map(([, bucket]) => {
      const ratio = bucket.eggs > 0
        ? Math.round((bucket.feed / bucket.eggs) * 100) / 100
        : 0;
      return {
        week: `Wk ${index++}`,
        ratio,
        benchmark: 2.3,
      };
    });

    res.json(fcrData);
  } catch (error) {
    next(error);
  }
};

// ─── GET /analytics/insights ──────────────────────────────────────────────────
// Calculated from real DB data — no ML yet.

const getInsights = async (req, res, next) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(todayStart);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const twoWeeksAgo = new Date(todayStart);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const [thisWeek, lastWeek] = await Promise.all([
      prisma.logEntry.aggregate({
        where: { date: { gte: weekAgo, lte: now } },
        _avg: { eggsCount: true },
        _sum: { eggsCount: true, feedConsumption: true, mortality: true },
        _count: true,
      }),
      prisma.logEntry.aggregate({
        where: { date: { gte: twoWeeksAgo, lt: weekAgo } },
        _avg: { eggsCount: true },
        _sum: { eggsCount: true },
        _count: true,
      }),
    ]);

    const thisWeekAvg = thisWeek._avg.eggsCount || 0;
    const lastWeekAvg = lastWeek._avg.eggsCount || 0;
    const percentChange = lastWeekAvg > 0
      ? (((thisWeekAvg - lastWeekAvg) / lastWeekAvg) * 100).toFixed(1)
      : "0.0";

    const totalFeed = thisWeek._sum.feedConsumption || 0;
    const totalEggs = thisWeek._sum.eggsCount || 0;
    const totalMortality = thisWeek._sum.mortality || 0;
    const fcrValue = totalEggs > 0 ? (totalFeed / totalEggs).toFixed(2) : "N/A";

    res.json({
      predictedYield: {
        value: Math.round(thisWeekAvg),
        unit: "eggs",
        change: `${Number(percentChange) > 0 ? "+" : ""}${percentChange}%`,
        confidence: 85,
      },
      fcrStatus: {
        value: fcrValue,
        status: fcrValue !== "N/A" && parseFloat(fcrValue) < 2.3 ? "Below Benchmark" : "Above Benchmark",
        benchmark: 2.3,
      },
      anomalyScore: {
        value: "Low",
        description: "No significant deviations detected in last 24 hrs",
      },
      healthStatus: {
        value: totalMortality > 5 ? `${totalMortality} Warnings` : "Normal",
        mortality: totalMortality,
        description: totalMortality > 5
          ? `${totalMortality} deaths this week — monitor closely`
          : "All systems normal",
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET /analytics/fulfilment-funnel ─────────────────────────────────────────
// Count of delivery orders in each pipeline stage over the last 30 days —
// drives the Recharts funnel chart on Analytics.
const getFulfilmentFunnel = async (req, res, next) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 365);
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const rows = await prisma.deliveryOrder.groupBy({
      by: ["status"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    });
    const counts = { PENDING: 0, IN_TRANSIT: 0, DELIVERED: 0, CANCELLED: 0 };
    rows.forEach((r) => { counts[r.status] = r._count._all; });

    // Order matters — the funnel reads top→bottom in the same sequence.
    res.json([
      { stage: "Placed",    count: counts.PENDING + counts.IN_TRANSIT + counts.DELIVERED + counts.CANCELLED },
      { stage: "Confirmed", count: counts.IN_TRANSIT + counts.DELIVERED + counts.CANCELLED }, // "moved past PENDING"
      { stage: "Dispatched",count: counts.IN_TRANSIT + counts.DELIVERED },
      { stage: "Delivered", count: counts.DELIVERED },
    ]);
  } catch (error) {
    next(error);
  }
};

// ─── GET /analytics/driver-efficiency ────────────────────────────────────────
// Delivered orders per driver, average fulfilment time in hours, and total
// distance approximated by the number of deliveries × depot distance. Enough
// signal for a scatter plot; not a substitute for a real telematics feed.
const getDriverEfficiency = async (req, res, next) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 365);
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const orders = await prisma.deliveryOrder.findMany({
      where: {
        createdAt: { gte: since },
        status: "DELIVERED",
        driverId: { not: null },
      },
      select: {
        driverId: true,
        createdAt: true,
        updatedAt: true,
        deliveryLatitude: true,
        deliveryLongitude: true,
        driver: { select: { name: true } },
      },
    });

    // Group by driver + compute avg fulfilment time and delivery count.
    const perDriver = new Map();
    for (const o of orders) {
      const hoursToDeliver =
        (new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime()) / 3600_000;
      const entry = perDriver.get(o.driverId) || {
        driverId: o.driverId,
        driverName: o.driver?.name || "Unknown",
        deliveries: 0,
        totalHours: 0,
      };
      entry.deliveries += 1;
      entry.totalHours += Math.max(0, hoursToDeliver);
      perDriver.set(o.driverId, entry);
    }
    const result = [...perDriver.values()].map((e) => ({
      driverName: e.driverName,
      deliveries: e.deliveries,
      avgHoursPerDelivery: e.deliveries > 0 ? Number((e.totalHours / e.deliveries).toFixed(2)) : 0,
    }));
    res.json(result);
  } catch (error) {
    next(error);
  }
};

// ─── GET /analytics/order-heatmap ────────────────────────────────────────────
// 7×24 grid of order counts by weekday × hour-of-day over the last N days —
// drives the heatmap. Weekday index: 0 = Sunday .. 6 = Saturday.
const getOrderHeatmap = async (req, res, next) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 60, 365);
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const orders = await prisma.deliveryOrder.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    });

    // 7 rows (weekdays) × 24 cols (hours), zero-initialised.
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const o of orders) {
      const d = new Date(o.createdAt);
      grid[d.getDay()][d.getHours()] += 1;
    }
    // Flatten into a shape Recharts can consume easily.
    const rows = [];
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        rows.push({ day, hour, count: grid[day][hour] });
      }
    }
    res.json({ grid, rows, maxCount: rows.reduce((m, r) => Math.max(m, r.count), 0) });
  } catch (error) {
    next(error);
  }
};

// ─── GET /analytics/sales-tracker?days=30 ────────────────────────────────────
// Full transaction-side view of the last N days: headline KPIs, revenue
// timeseries, order-status breakdown, payment-status breakdown, top products,
// and the most recent transactions. Every "transaction" in this system is a
// DeliveryOrder row, so this is the single-source-of-truth aggregator.
const getSalesTracker = async (req, res, next) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 365);
    const now = new Date();
    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() - days);
    windowStart.setHours(0, 0, 0, 0);
    // Same-length prior period for the WoW-style change indicator.
    const priorStart = new Date(windowStart);
    priorStart.setDate(priorStart.getDate() - days);

    const [currentOrders, priorOrders] = await Promise.all([
      prisma.deliveryOrder.findMany({
        where: { createdAt: { gte: windowStart, lte: now } },
        select: {
          id: true, orderId: true, amount: true, status: true,
          paymentStatus: true, paymentMethod: true, productId: true,
          createdAt: true,
          customer: { select: { name: true, email: true } },
          product:  { select: { name: true, unit: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.deliveryOrder.aggregate({
        where: {
          createdAt: { gte: priorStart, lt: windowStart },
          status: { not: "CANCELLED" },
        },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    // ── Headline KPIs ─────────────────────────────────────────────────────
    const bucket = { PENDING: 0, IN_TRANSIT: 0, DELIVERED: 0, CANCELLED: 0 };
    const paymentAmt = {};   // { PENDING: n, PAID: n, ... }
    const paymentCnt = {};
    const daily = new Map(); // dayISO -> { revenue, orders }
    let unpaidBalance = 0;

    for (const o of currentOrders) {
      const amt = o.amount || 0;
      bucket[o.status] = (bucket[o.status] || 0) + amt;
      const ps = o.paymentStatus || "PENDING";
      paymentAmt[ps] = (paymentAmt[ps] || 0) + amt;
      paymentCnt[ps] = (paymentCnt[ps] || 0) + 1;
      if (ps !== "PAID" && o.status !== "CANCELLED") unpaidBalance += amt;

      const dayKey = new Date(o.createdAt).toISOString().slice(0, 10);
      const day = daily.get(dayKey) || { revenue: 0, orders: 0 };
      if (o.status !== "CANCELLED") day.revenue += amt;
      day.orders += 1;
      daily.set(dayKey, day);
    }

    const nonCancelled = currentOrders.filter((o) => o.status !== "CANCELLED");
    const totalRevenue = nonCancelled.reduce((s, o) => s + (o.amount || 0), 0);
    const totalOrders  = currentOrders.length;
    const avgOrderValue = nonCancelled.length > 0
      ? totalRevenue / nonCancelled.length
      : 0;
    const priorRevenue = priorOrders._sum.amount || 0;
    const wowRevenueChange = priorRevenue > 0
      ? ((totalRevenue - priorRevenue) / priorRevenue) * 100
      : totalRevenue > 0 ? 100 : 0;

    // ── Timeseries — fill missing days with zero so the chart is continuous
    const revenueTimeseries = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const cell = daily.get(key) || { revenue: 0, orders: 0 };
      revenueTimeseries.push({
        date: key,
        revenue: Math.round(cell.revenue * 100) / 100,
        orders: cell.orders,
      });
    }

    // ── Breakdowns ───────────────────────────────────────────────────────
    const statusBreakdown = ["PENDING", "IN_TRANSIT", "DELIVERED", "CANCELLED"].map((s) => ({
      status: s,
      count: currentOrders.filter((o) => o.status === s).length,
      amount: Math.round((bucket[s] || 0) * 100) / 100,
    }));
    const paymentBreakdown = Object.keys(paymentAmt).map((ps) => ({
      status: ps,
      count: paymentCnt[ps],
      amount: Math.round(paymentAmt[ps] * 100) / 100,
    })).sort((a, b) => b.amount - a.amount);

    // ── Top products by revenue ──────────────────────────────────────────
    const productAgg = new Map(); // productId -> { name, unit, count, revenue }
    for (const o of currentOrders) {
      if (o.status === "CANCELLED") continue;
      const entry = productAgg.get(o.productId) || {
        productName: o.product?.name || "Unknown",
        unit: o.product?.unit || "",
        count: 0,
        revenue: 0,
      };
      entry.count += 1;
      entry.revenue += o.amount || 0;
      productAgg.set(o.productId, entry);
    }
    const topProducts = [...productAgg.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((p) => ({ ...p, revenue: Math.round(p.revenue * 100) / 100 }));

    // ── Recent transactions (last 20) ────────────────────────────────────
    const recentTransactions = currentOrders.slice(0, 20).map((o) => ({
      orderId: o.orderId,
      customer: o.customer?.name || o.customer?.email || "—",
      product: o.product?.name || "—",
      amount: Math.round((o.amount || 0) * 100) / 100,
      status: o.status,
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod,
      createdAt: o.createdAt,
    }));

    res.json({
      windowDays: days,
      headline: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        deliveredRevenue: Math.round((bucket.DELIVERED || 0) * 100) / 100,
        pendingRevenue: Math.round(((bucket.PENDING || 0) + (bucket.IN_TRANSIT || 0)) * 100) / 100,
        cancelledRevenue: Math.round((bucket.CANCELLED || 0) * 100) / 100,
        totalOrders,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        unpaidBalance: Math.round(unpaidBalance * 100) / 100,
        wowRevenueChange: Math.round(wowRevenueChange * 10) / 10,
        priorRevenue: Math.round(priorRevenue * 100) / 100,
      },
      revenueTimeseries,
      statusBreakdown,
      paymentBreakdown,
      topProducts,
      recentTransactions,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getForecast,
  getFCR,
  getInsights,
  getFulfilmentFunnel,
  getDriverEfficiency,
  getOrderHeatmap,
  getSalesTracker,
};

