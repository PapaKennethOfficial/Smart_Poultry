const prisma = require("../config/prisma");
const aiClient = require("../config/aiClient");

// ─── Domain constants ─────────────────────────────────────────────────────────
// Average mass of one egg, in kg. Used to convert an egg COUNT into an egg MASS
// so Feed Conversion Ratio is a mass-over-mass figure and can be compared to the
// industry benchmark. ~60 g is typical for a commercial layer; override with
// AVG_EGG_MASS_KG if this farm's grading says otherwise.
const AVG_EGG_MASS_KG = Number(process.env.AVG_EGG_MASS_KG) || 0.06;

// Layer FCR benchmark: kg of feed per kg of egg produced. 2.0-2.4 is the normal
// commercial band; 2.3 is the mid-point we hold ourselves to.
const FCR_BENCHMARK = Number(process.env.FCR_BENCHMARK) || 2.3;

// How many standard deviations from the trailing mean counts as an anomaly.
const ANOMALY_SIGMA = Number(process.env.ANOMALY_SIGMA) || 2;

// ─── Small statistics helpers ─────────────────────────────────────────────────

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values) {
  if (values.length < 2) return 0;
  const m = mean(values);
  // Sample standard deviation (n-1): we are estimating from a sample of days,
  // not measuring a complete population.
  const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Z-score of `current` against a baseline series.
 * Returns null when the baseline is too short or completely flat — in both
 * cases a z-score would be meaningless or infinite.
 */
function zScore(current, baseline) {
  if (baseline.length < 3) return null;
  const sd = stdDev(baseline);
  if (sd === 0) return null;
  return (current - mean(baseline)) / sd;
}

/**
 * Feed Conversion Ratio: kg of feed per kg of eggs produced.
 *
 * The previous implementation divided feed mass by an egg COUNT, which is a
 * dimensionless nonsense figure — it produced ~0.10 and then compared it to the
 * 2.3 mass-ratio benchmark, implying the farm was ~23x better than a world
 * record. Converting the count to a mass first makes the comparison valid.
 */
function feedConversionRatio(feedKg, eggCount) {
  const eggMassKg = eggCount * AVG_EGG_MASS_KG;
  if (eggMassKg <= 0) return null;
  return feedKg / eggMassKg;
}

// ─── GET /analytics/trend/eggs?days=10 ────────────────────────────────────────
// Daily egg totals for the last N days. These are MEASUREMENTS, not predictions.
//
// This endpoint used to be called /forecast and returned exactly this data with
// the field named `predicted` and a hardcoded `confidence: 85`. It was never a
// forecast — no model was involved. The real forward-looking egg forecast is
// Prophet, served by the AI microservice at GET /api/ai/forecast/eggs.
//
// The old route and field names are still served as deprecated aliases so the
// current frontend keeps working; see the bottom of this function.

const getForecast = async (req, res, next) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 10, 365);
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const entries = await prisma.logEntry.findMany({
      // Soft-deleted rows are corrections; counting them double-counts.
      where: { date: { gte: since }, deletedAt: null },
      select: { date: true, eggsCount: true },
      orderBy: { date: "asc" },
    });

    // Aggregate eggs per calendar day
    const dayMap = new Map();
    entries.forEach((e) => {
      const dayKey = new Date(e.date).toISOString().slice(0, 10);
      dayMap.set(dayKey, (dayMap.get(dayKey) || 0) + (e.eggsCount || 0));
    });

    const trend = Array.from(dayMap.entries()).map(([dateStr, eggs]) => {
      const d = new Date(dateStr);
      return {
        date: dateStr,
        day: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        // The honest name for this number.
        actual: eggs,
        // DEPRECATED alias, kept so the existing Analytics chart keeps
        // rendering while the frontend migrates to `actual`. Remove once
        // Analytics.jsx reads the new field.
        predicted: eggs,
      };
    });

    // If no data exists, return empty array (frontend handles gracefully)
    res.json(trend);
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
      const ratio = feedConversionRatio(bucket.feed, bucket.eggs);
      return {
        week: `Wk ${index++}`,
        // null (not 0) when a week has no eggs — 0 would plot as a real
        // data point meaning "perfectly efficient", which is the opposite
        // of "we have no data".
        ratio: ratio === null ? null : Math.round(ratio * 100) / 100,
        benchmark: FCR_BENCHMARK,
        feedKg: Math.round(bucket.feed * 100) / 100,
        eggs: bucket.eggs,
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

    // Pull 22 days once and derive everything from it. One query instead of
    // three, and every figure below is computed on the same rows.
    const baselineStart = new Date(todayStart);
    baselineStart.setDate(baselineStart.getDate() - 22);

    const entries = await prisma.logEntry.findMany({
      where: { date: { gte: baselineStart }, deletedAt: null },
      select: {
        date: true,
        mortality: true,
        eggsCount: true,
        feedConsumption: true,
        waterConsumption: true,
      },
      orderBy: { date: "asc" },
    });

    // Roll up to one row PER CALENDAR DAY. This matters: several batches are
    // logged each day, so averaging raw LogEntry rows (what this code used to
    // do with prisma.aggregate _avg) gives the average per batch-entry, not
    // per day. With three batches that understated daily output roughly 3x.
    const byDay = new Map();
    for (const e of entries) {
      const key = new Date(e.date).toISOString().slice(0, 10);
      const bucket = byDay.get(key) || { mortality: 0, eggsCount: 0, feed: 0, water: 0 };
      bucket.mortality += e.mortality || 0;
      bucket.eggsCount += e.eggsCount || 0;
      bucket.feed += e.feedConsumption || 0;
      bucket.water += e.waterConsumption || 0;
      byDay.set(key, bucket);
    }

    const dayKeys = [...byDay.keys()].sort();
    const dayKey = (d) => d.toISOString().slice(0, 10);

    const weekAgoKey = dayKey(new Date(todayStart.getTime() - 7 * 86400000));
    const twoWeeksAgoKey = dayKey(new Date(todayStart.getTime() - 14 * 86400000));

    const thisWeekKeys = dayKeys.filter((k) => k >= weekAgoKey);
    const lastWeekKeys = dayKeys.filter((k) => k >= twoWeeksAgoKey && k < weekAgoKey);

    const sumOver = (keys, field) =>
      keys.reduce((acc, k) => acc + byDay.get(k)[field], 0);
    const avgPerDay = (keys, field) =>
      keys.length ? sumOver(keys, field) / keys.length : 0;

    const thisWeekAvg = avgPerDay(thisWeekKeys, "eggsCount");
    const lastWeekAvg = avgPerDay(lastWeekKeys, "eggsCount");
    const percentChange = lastWeekAvg > 0
      ? (((thisWeekAvg - lastWeekAvg) / lastWeekAvg) * 100).toFixed(1)
      : "0.0";

    const totalFeed = sumOver(thisWeekKeys, "feed");
    const totalEggs = sumOver(thisWeekKeys, "eggsCount");
    const totalMortality = sumOver(thisWeekKeys, "mortality");

    const fcrRatio = feedConversionRatio(totalFeed, totalEggs);
    const fcrValue = fcrRatio === null ? "N/A" : fcrRatio.toFixed(2);

    // ── Anomaly detection ──────────────────────────────────────────────────
    // Latest day vs the 21 before it, per metric. Anything past ANOMALY_SIGMA
    // is reported by name. Replaces a hardcoded "Low" that would have read
    // "Low" during a mass-mortality event.
    const anomalies = [];

    if (dayKeys.length >= 4) {
      const latest = byDay.get(dayKeys[dayKeys.length - 1]);
      const baselineKeys = dayKeys.slice(0, -1);

      const checks = [
        { key: "mortality", label: "Mortality", value: latest.mortality, worseWhen: "high" },
        { key: "eggsCount", label: "Egg output", value: latest.eggsCount, worseWhen: "low" },
        { key: "feed",      label: "Feed use",   value: latest.feed,      worseWhen: "either" },
        { key: "water",     label: "Water use",  value: latest.water,     worseWhen: "either" },
      ];

      for (const check of checks) {
        const baseline = baselineKeys.map((k) => byDay.get(k)[check.key]);
        const z = zScore(check.value, baseline);
        if (z === null || Math.abs(z) < ANOMALY_SIGMA) continue;

        // Only flag the direction that is actually a problem. High mortality
        // matters; an unusually LOW mortality day is good news.
        const isBad =
          check.worseWhen === "either" ||
          (check.worseWhen === "high" && z > 0) ||
          (check.worseWhen === "low" && z < 0);
        if (!isBad) continue;

        anomalies.push({
          metric: check.label,
          z: Math.round(z * 100) / 100,
          direction: z > 0 ? "above" : "below",
          value: Math.round(check.value * 100) / 100,
          baselineMean: Math.round(mean(baseline) * 100) / 100,
        });
      }
      anomalies.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
    }

    const worst = anomalies[0];
    const anomalyLevel = !worst ? "Low" : Math.abs(worst.z) >= 3 ? "High" : "Moderate";
    const anomalyDescription = !worst
      ? dayKeys.length < 4
        ? "Not enough logbook history yet to detect anomalies"
        : `No metric outside ${ANOMALY_SIGMA} sigma of its 21-day baseline`
      : `${worst.metric} is ${worst.direction} normal (${worst.value} vs ${worst.baselineMean} avg, ${Math.abs(worst.z).toFixed(1)} sigma)`;

    res.json({
      // A 7-day trailing average of DAILY totals — not a prediction. The real
      // forward-looking egg forecast is Prophet, at GET /api/ai/forecast/eggs.
      recentYield: {
        value: Math.round(thisWeekAvg),
        unit: "eggs",
        basis: "daily average, last 7 days",
        change: `${Number(percentChange) > 0 ? "+" : ""}${percentChange}%`,
        daysCounted: thisWeekKeys.length,
      },
      fcrStatus: {
        value: fcrValue,
        unit: "kg feed / kg eggs",
        // Lower is better. Machine-readable verdict so the UI never has to
        // string-match prose.
        verdict:
          fcrRatio === null ? "unknown" : fcrRatio <= FCR_BENCHMARK ? "better" : "worse",
        status:
          fcrRatio === null
            ? "No data"
            : fcrRatio <= FCR_BENCHMARK
              ? "Better than benchmark"
              : "Worse than benchmark",
        benchmark: FCR_BENCHMARK,
        feedKg: Math.round(totalFeed * 100) / 100,
        eggs: totalEggs,
        eggMassKg: AVG_EGG_MASS_KG,
      },
      anomalyScore: {
        value: anomalyLevel,
        description: anomalyDescription,
        sigma: ANOMALY_SIGMA,
        detected: anomalies,
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

// ─── GET /analytics/supply-vs-demand?days=30 ─────────────────────────────────
// Eggs produced (LogEntry) against eggs ordered (DeliveryOrder), on one axis.
// The farm half and the commerce half of this system share a database and,
// until this endpoint, nothing else. This is the join that makes the product
// more than two apps stapled together.
const getSupplyVsDemand = async (req, res, next) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 365);
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const [logs, orders] = await Promise.all([
      prisma.logEntry.findMany({
        where: { date: { gte: since }, deletedAt: null },
        select: { date: true, eggsCount: true },
      }),
      prisma.deliveryOrder.findMany({
        where: { deliveryDate: { gte: since }, status: { not: "CANCELLED" } },
        select: { deliveryDate: true, quantity: true },
      }),
    ]);

    const byDay = new Map();
    const bucket = (key) => {
      if (!byDay.has(key)) byDay.set(key, { produced: 0, ordered: 0 });
      return byDay.get(key);
    };
    for (const l of logs) {
      bucket(new Date(l.date).toISOString().slice(0, 10)).produced += l.eggsCount || 0;
    }
    for (const o of orders) {
      bucket(new Date(o.deliveryDate).toISOString().slice(0, 10)).ordered += o.quantity || 0;
    }

    const raw = [...byDay.entries()].sort().map(([day, b]) => ({
      date: day,
      produced: b.produced,
      ordered: b.ordered,
    }));

    const totalProduced = raw.reduce((s, r) => s + r.produced, 0);
    const totalOrdered = raw.reduce((s, r) => s + r.ordered, 0);

    // ── Indexing ────────────────────────────────────────────────────────────
    // The two series are in DIFFERENT UNITS. `produced` is a count of eggs
    // (hundreds per day); `ordered` sums DeliveryOrder.quantity, whose unit
    // varies per product (kg, crate, ...). Plotting both raw on one axis makes
    // the smaller one lie flat along zero, which is what made this chart look
    // broken.
    //
    // A second y-axis would be the usual reflex and is the wrong answer: two
    // scales let you manufacture any crossing you like. Instead each series is
    // indexed to ITS OWN daily average over the window, so 100 means "a normal
    // day for this measure". A gap between the lines is then a real statement:
    // demand is running above its norm while production runs below its own.
    // Absolute values are carried alongside for the tooltip.
    const dayCount = raw.length || 1;
    const avgProduced = totalProduced / dayCount;
    const avgOrdered = totalOrdered / dayCount;
    const idx = (value, avg) => (avg > 0 ? Math.round((value / avg) * 1000) / 10 : null);

    const series = raw.map((r) => ({
      date: r.date,
      day: new Date(r.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      produced: r.produced,
      ordered: r.ordered,
      surplus: r.produced - r.ordered,
      producedIndex: idx(r.produced, avgProduced),
      orderedIndex: idx(r.ordered, avgOrdered),
      isForecast: false,
    }));

    // ── Forward projection ──────────────────────────────────────────────────
    // Prophet forecasts both series. Failure here must never break the chart:
    // history is the point, projection is the bonus.
    let forecastDays = 0;
    let forecastAvailable = false;
    try {
      const horizon = Math.min(14, Math.max(7, Math.round(days / 3)));
      const [eggRes, demandRes] = await Promise.all([
        aiClient.get("/api/v1/forecast/eggs", { params: { days: horizon } }),
        aiClient.get("/api/v1/forecast/demand", { params: { days: horizon } }),
      ]);

      const eggF = eggRes.data?.forecast || [];
      const demandF = demandRes.data?.forecast || [];
      const demandByDs = new Map(demandF.map((f) => [f.ds, f]));

      // Join the last real point to the first predicted one, otherwise the
      // dashed line starts detached from the solid one.
      if (series.length) {
        const last = series[series.length - 1];
        last.forecastProducedIndex = last.producedIndex;
        last.forecastOrderedIndex = last.orderedIndex;
      }

      for (const f of eggF) {
        const d = demandByDs.get(f.ds);
        series.push({
          date: f.ds,
          day: new Date(f.ds).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
          produced: null,
          ordered: null,
          surplus: null,
          producedIndex: null,
          orderedIndex: null,
          forecastProducedIndex: idx(f.yhat, avgProduced),
          forecastOrderedIndex: d ? idx(d.yhat, avgOrdered) : null,
          forecastProduced: Math.round(f.yhat),
          forecastOrdered: d ? Math.round(d.yhat) : null,
          isForecast: true,
        });
      }
      forecastDays = eggF.length;
      forecastAvailable = forecastDays > 0;
    } catch (err) {
      console.error("[supply-vs-demand] forecast unavailable:", err.message);
    }

    const history = series.filter((r) => !r.isForecast);
    const daysShort = history.filter((r) => r.surplus < 0).length;

    res.json({
      series,
      totalProduced,
      totalOrdered,
      netSurplus: totalProduced - totalOrdered,
      coveragePct: totalOrdered > 0
        ? Math.round((totalProduced / totalOrdered) * 1000) / 10
        : null,
      daysShort,
      worstShortfall: history.length
        ? history.reduce((w, r) => (r.surplus < w.surplus ? r : w), history[0])
        : null,
      avgProduced: Math.round(avgProduced),
      avgOrdered: Math.round(avgOrdered),
      forecastDays,
      forecastAvailable,
      windowDays: days,
      // Stated in the response so the UI never has to assume they match.
      unitsComparable: false,
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

    // We need each order's history, not just its final status: an order that
    // was cancelled while still PENDING never reached "dispatched", but one
    // cancelled after dispatch did. The previous version added ALL cancelled
    // orders into the Confirmed stage, which inflated it and could make the
    // funnel widen as it went down — impossible for a real funnel.
    const orders = await prisma.deliveryOrder.findMany({
      where: { createdAt: { gte: since } },
      select: { status: true, statusHistory: true },
    });

    const reached = { placed: 0, confirmed: 0, dispatched: 0, delivered: 0 };

    for (const o of orders) {
      reached.placed += 1;

      const history = Array.isArray(o.statusHistory) ? o.statusHistory : [];
      const seen = new Set(history.map((h) => h && h.status).filter(Boolean));
      // The current status counts as reached even if history is missing —
      // rows created before statusHistory existed still have a status.
      seen.add(o.status);

      const everDispatched = seen.has("IN_TRANSIT") || seen.has("DELIVERED");
      const everDelivered = seen.has("DELIVERED");
      // "Confirmed" = a driver was assigned, or it moved past PENDING at all.
      const everConfirmed = everDispatched || seen.has("DRIVER_ASSIGNED");

      if (everConfirmed) reached.confirmed += 1;
      if (everDispatched) reached.dispatched += 1;
      if (everDelivered) reached.delivered += 1;
    }

    // Order matters — the funnel reads top→bottom in the same sequence, and
    // each stage is now guaranteed <= the one above it.
    res.json([
      { stage: "Placed",     count: reached.placed },
      { stage: "Confirmed",  count: reached.confirmed },
      { stage: "Dispatched", count: reached.dispatched },
      { stage: "Delivered",  count: reached.delivered },
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
        statusHistory: true,
        deliveryLatitude: true,
        deliveryLongitude: true,
        driver: { select: { name: true } },
      },
    });

    // Group by driver + compute avg fulfilment time and delivery count.
    //
    // updatedAt is NOT the delivery time — it moves on any write, including a
    // payment-status change or a note edit weeks later, which silently inflated
    // every driver's average. Prefer the DELIVERED entry in statusHistory and
    // fall back to updatedAt only when history predates that field.
    const deliveredAtOf = (order) => {
      const history = Array.isArray(order.statusHistory) ? order.statusHistory : [];
      for (let i = history.length - 1; i >= 0; i--) {
        const h = history[i];
        if (h && h.status === "DELIVERED" && h.timestamp) {
          const t = new Date(h.timestamp);
          if (!Number.isNaN(t.getTime())) return t;
        }
      }
      return new Date(order.updatedAt);
    };

    const perDriver = new Map();
    for (const o of orders) {
      const hoursToDeliver =
        (deliveredAtOf(o).getTime() - new Date(o.createdAt).getTime()) / 3600_000;
      const entry = perDriver.get(o.driverId) || {
        driverId: o.driverId,
        driverName: o.driver?.name || "Unknown",
        deliveries: 0,
        totalHours: 0,
        hours: [],
      };
      entry.deliveries += 1;
      entry.totalHours += Math.max(0, hoursToDeliver);
      entry.hours.push(Math.max(0, hoursToDeliver));
      perDriver.set(o.driverId, entry);
    }
    const result = [...perDriver.values()].map((e) => {
      const sorted = [...e.hours].sort((a, b) => a - b);
      const pct = (q) =>
        sorted.length ? Number(sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))].toFixed(2)) : 0;
      return {
        driverName: e.driverName,
        deliveries: e.deliveries,
        avgHoursPerDelivery: e.deliveries > 0 ? Number((e.totalHours / e.deliveries).toFixed(2)) : 0,
        // The mean hides the tail. p90 is the number a customer complains about.
        medianHours: pct(0.5),
        p90Hours: pct(0.9),
      };
    });
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
  getSupplyVsDemand,
  getForecast,
  getFCR,
  getInsights,
  getFulfilmentFunnel,
  getDriverEfficiency,
  getOrderHeatmap,
  getSalesTracker,
};

