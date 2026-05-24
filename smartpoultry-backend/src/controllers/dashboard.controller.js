const prisma = require("../config/prisma");

// ─── Date helpers ────────────────────────────────────────────────────────────

/** Return a new Date at 00:00:00.000 (local) for the given date. */
function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Return a new Date at 23:59:59.999 (local) for the given date. */
function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** ISO weekday-style key (yyyy-mm-dd in local time) for bucketing. */
function dayKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── GET /dashboard/summary ──────────────────────────────────────────────────
// Today's snapshot for the four headline stat cards.
const getSummary = async (req, res, next) => {
  try {
    const today = new Date();
    const from = startOfDay(today);
    const to = endOfDay(today);

    // Run independent queries in parallel for speed.
    const [logsAgg, batches, pendingDeliveries] = await Promise.all([
      prisma.logEntry.aggregate({
        where: { date: { gte: from, lte: to } },
        _sum: { eggsCount: true, feedConsumption: true, mortality: true },
      }),
      prisma.batch.findMany({
        where: { status: "ACTIVE" },
        select: { currentCount: true },
      }),
      prisma.deliveryOrder.count({ where: { status: "PENDING" } }),
    ]);

    const totalEggs = logsAgg._sum.eggsCount || 0;
    const feedUsed = logsAgg._sum.feedConsumption || 0;
    const todaysMortality = logsAgg._sum.mortality || 0;
    const flockSize = batches.reduce((sum, b) => sum + b.currentCount, 0);

    // Mortality rate as a percentage of the active flock. 0 when no flock exists.
    const mortalityRate =
      flockSize > 0 ? Number(((todaysMortality / flockSize) * 100).toFixed(2)) : 0;

    res.status(200).json({
      totalEggs,
      mortalityRate,
      pendingDeliveries,
      feedUsed,
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET /dashboard/egg-chart?days=7 ─────────────────────────────────────────
// Returns N day-buckets of summed eggsCount, oldest → newest.
// Days with no log entries are zero-filled so Recharts has a continuous series.
const getEggChart = async (req, res, next) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 365);

    const today = startOfDay(new Date());
    const from = new Date(today);
    from.setDate(from.getDate() - (days - 1));

    const entries = await prisma.logEntry.findMany({
      where: { date: { gte: from, lte: endOfDay(new Date()) } },
      select: { date: true, eggsCount: true },
    });

    // Bucket by yyyy-mm-dd
    const buckets = new Map();
    for (const e of entries) {
      const key = dayKey(e.date);
      buckets.set(key, (buckets.get(key) || 0) + (e.eggsCount || 0));
    }

    // Zero-fill the window
    const series = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(from);
      d.setDate(from.getDate() + i);
      const key = dayKey(d);
      series.push({
        date: key,
        day: WEEKDAY[d.getDay()],
        eggs: buckets.get(key) || 0,
      });
    }

    res.status(200).json(series);
  } catch (error) {
    next(error);
  }
};

// ─── GET /dashboard/mortality-chart?weeks=6 ──────────────────────────────────
// Returns N week-buckets (Mon→Sun) of summed mortality, oldest → newest.
const getMortalityChart = async (req, res, next) => {
  try {
    const weeks = Math.min(Math.max(parseInt(req.query.weeks, 10) || 6, 1), 52);

    // Anchor on the Monday of the current week (local time)
    const now = new Date();
    const dow = now.getDay(); // 0 = Sunday
    const daysSinceMonday = (dow + 6) % 7;
    const thisMonday = startOfDay(now);
    thisMonday.setDate(thisMonday.getDate() - daysSinceMonday);

    const from = new Date(thisMonday);
    from.setDate(from.getDate() - (weeks - 1) * 7);

    const entries = await prisma.logEntry.findMany({
      where: { date: { gte: from, lte: endOfDay(new Date()) } },
      select: { date: true, mortality: true },
    });

    // Bucket by week index (0 = oldest)
    const counts = new Array(weeks).fill(0);
    for (const e of entries) {
      const diffDays = Math.floor((e.date - from) / (24 * 60 * 60 * 1000));
      const idx = Math.floor(diffDays / 7);
      if (idx >= 0 && idx < weeks) counts[idx] += e.mortality || 0;
    }

    const series = counts.map((count, i) => ({
      week: `Wk ${i + 1}`,
      count,
    }));

    res.status(200).json(series);
  } catch (error) {
    next(error);
  }
};

module.exports = { getSummary, getEggChart, getMortalityChart };
