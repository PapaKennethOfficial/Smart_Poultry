/**
 * Report sections: the data behind each printed visual, plus its AI narration.
 *
 * Narration reuses the same /insights/explain-chart endpoint the dashboard
 * buttons call, so a chart is described identically on screen and on paper.
 *
 * Rate limiting is the real constraint. Groq's free tier allows ~6,000 tokens
 * per minute and one explanation costs ~1,800, so four sections fired at once
 * would exceed it. Calls are SEQUENTIAL with a pause between them, and any
 * failure degrades to chart-plus-table rather than failing the whole report.
 */

const prisma = require("../config/prisma");
const aiClient = require("../config/aiClient");

const AVG_EGG_MASS_KG = Number(process.env.AVG_EGG_MASS_KG) || 0.06;
const FCR_BENCHMARK = Number(process.env.FCR_BENCHMARK) || 2.3;
// Pacing between narration calls, to stay inside the provider's per-minute
// token budget. This was 4000 when each prompt ran ~1,800 tokens; the context
// has since been trimmed to roughly 1,200, so four sections cost ~5k tokens and
// a shorter gap still fits. Raise it if the provider starts returning 429.
const NARRATION_GAP_MS = Number(process.env.REPORT_NARRATION_GAP_MS) || 1500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shortDay = (d) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** Daily egg totals, one row per calendar day. */
async function eggSection(start, end) {
  const entries = await prisma.logEntry.findMany({
    where: { date: { gte: start, lte: end }, deletedAt: null },
    select: { date: true, eggsCount: true, mortality: true, feedConsumption: true },
    orderBy: { date: "asc" },
  });

  const byDay = new Map();
  for (const e of entries) {
    const key = new Date(e.date).toISOString().slice(0, 10);
    const b = byDay.get(key) || { eggs: 0, mortality: 0, feed: 0 };
    b.eggs += e.eggsCount || 0;
    b.mortality += e.mortality || 0;
    b.feed += e.feedConsumption || 0;
    byDay.set(key, b);
  }

  const rows = [...byDay.entries()].sort().map(([day, b]) => ({
    day, label: shortDay(day), eggs: b.eggs, mortality: b.mortality,
    feedKg: Math.round(b.feed * 100) / 100,
  }));
  const totalEggs = rows.reduce((s, r) => s + r.eggs, 0);

  return {
    id: "egg_trend",
    title: "Egg Production",
    chart: { type: "line", data: rows.map((r) => ({ label: r.label, value: r.eggs })) },
    table: {
      columns: [
        { header: "Date", key: "label", width: 90 },
        { header: "Eggs", key: "eggs", width: 90, align: "right" },
        { header: "Mortality", key: "mortality", width: 90, align: "right" },
        { header: "Feed (kg)", key: "feedKg", width: 90, align: "right" },
      ],
      rows,
    },
    summary: {
      "Total eggs": totalEggs.toLocaleString(),
      "Daily average": rows.length ? Math.round(totalEggs / rows.length).toLocaleString() : "-",
      "Days logged": rows.length,
    },
  };
}

/** Weekly feed conversion ratio against the benchmark. */
async function fcrSection(start, end) {
  const entries = await prisma.logEntry.findMany({
    where: { date: { gte: start, lte: end }, deletedAt: null },
    select: { date: true, feedConsumption: true, eggsCount: true },
    orderBy: { date: "asc" },
  });

  const byWeek = new Map();
  for (const e of entries) {
    const d = new Date(e.date);
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    const b = byWeek.get(key) || { feed: 0, eggs: 0 };
    b.feed += e.feedConsumption || 0;
    b.eggs += e.eggsCount || 0;
    byWeek.set(key, b);
  }

  const rows = [...byWeek.entries()].sort().map(([week, b]) => {
    const eggMass = b.eggs * AVG_EGG_MASS_KG;
    // kg feed per kg eggs. Null, not zero, when no eggs were recorded —
    // zero would read as "perfectly efficient".
    const fcr = eggMass > 0 ? Math.round((b.feed / eggMass) * 100) / 100 : null;
    return { week, label: "w/c " + shortDay(week),
             feedKg: Math.round(b.feed * 100) / 100, eggs: b.eggs, fcr };
  });

  return {
    id: "fcr",
    title: "Feed Conversion Ratio",
    chart: {
      type: "bar",
      data: rows.map((r) => ({ label: r.label, value: r.fcr })),
      benchmark: FCR_BENCHMARK, benchmarkLabel: "Benchmark",
    },
    table: {
      columns: [
        { header: "Week starting", key: "label", width: 110 },
        { header: "Feed (kg)", key: "feedKg", width: 90, align: "right" },
        { header: "Eggs", key: "eggs", width: 90, align: "right" },
        { header: "FCR", key: "fcr", width: 70, align: "right" },
      ],
      rows,
    },
    summary: { "Benchmark": FCR_BENCHMARK + " kg feed / kg eggs", "Lower is": "better" },
  };
}

/** Order fulfilment funnel, based on what each order actually reached. */
async function funnelSection(start, end) {
  const orders = await prisma.deliveryOrder.findMany({
    where: { createdAt: { gte: start, lte: end } },
    select: { status: true, statusHistory: true },
  });

  let placed = 0, confirmed = 0, dispatched = 0, delivered = 0;
  for (const o of orders) {
    placed += 1;
    const history = Array.isArray(o.statusHistory) ? o.statusHistory : [];
    const seen = new Set(history.map((h) => h && h.status).filter(Boolean));
    seen.add(o.status);
    const everDispatched = seen.has("IN_TRANSIT") || seen.has("DELIVERED");
    if (everDispatched || seen.has("DRIVER_ASSIGNED")) confirmed += 1;
    if (everDispatched) dispatched += 1;
    if (seen.has("DELIVERED")) delivered += 1;
  }

  const stages = [
    { stage: "Placed", count: placed },
    { stage: "Confirmed", count: confirmed },
    { stage: "Dispatched", count: dispatched },
    { stage: "Delivered", count: delivered },
  ];

  return {
    id: "fulfilment_funnel",
    title: "Order Fulfilment",
    chart: { type: "funnel", data: stages },
    table: {
      columns: [
        { header: "Stage", key: "stage", width: 160 },
        { header: "Orders", key: "count", width: 90, align: "right" },
      ],
      rows: stages,
    },
    summary: {
      "Completion rate": placed ? Math.round((delivered / placed) * 100) + "%" : "-",
      "Orders placed": placed,
    },
  };
}

/** Daily revenue, cancelled orders excluded. */
async function revenueSection(start, end) {
  const orders = await prisma.deliveryOrder.findMany({
    where: { createdAt: { gte: start, lte: end }, status: { not: "CANCELLED" } },
    select: { createdAt: true, amount: true },
    orderBy: { createdAt: "asc" },
  });

  const byDay = new Map();
  for (const o of orders) {
    const key = new Date(o.createdAt).toISOString().slice(0, 10);
    const b = byDay.get(key) || { revenue: 0, orders: 0 };
    b.revenue += o.amount || 0;
    b.orders += 1;
    byDay.set(key, b);
  }

  const rows = [...byDay.entries()].sort().map(([day, b]) => ({
    day, label: shortDay(day),
    revenue: Math.round(b.revenue * 100) / 100, orders: b.orders,
  }));
  const total = rows.reduce((s, r) => s + r.revenue, 0);

  return {
    id: "revenue_timeseries",
    title: "Revenue",
    chart: { type: "line", data: rows.map((r) => ({ label: r.label, value: r.revenue })) },
    table: {
      columns: [
        { header: "Date", key: "label", width: 110 },
        { header: "Revenue (GHS)", key: "revenue", width: 110, align: "right" },
        { header: "Orders", key: "orders", width: 80, align: "right" },
      ],
      rows,
    },
    summary: {
      "Total revenue": "GHS " + Math.round(total).toLocaleString(),
      "Orders": orders.length,
      "Average order": orders.length
        ? "GHS " + Math.round(total / orders.length).toLocaleString() : "-",
    },
  };
}

const BUILDERS = {
  egg_trend: eggSection,
  fcr: fcrSection,
  fulfilment_funnel: funnelSection,
  revenue_timeseries: revenueSection,
};

/**
 * Build sections, then narrate them one at a time.
 * Pass narrate:false to skip the LLM entirely.
 */
async function buildSections(start, end, opts) {
  const { ids = Object.keys(BUILDERS), narrate = true, windowDays } = opts || {};
  const sections = [];

  for (const id of ids) {
    const builder = BUILDERS[id];
    if (!builder) continue;
    try {
      sections.push(await builder(start, end));
    } catch (err) {
      console.error("[report] section " + id + " failed:", err.message);
    }
  }

  if (!narrate) return sections;

  const startedAt = Date.now();
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    console.log(`[report] narrating ${i + 1}/${sections.length} (${section.id})...`);
    try {
      const body = { chart_id: section.id };
      if (windowDays) body.window = windowDays;
      const { data } = await aiClient.post("/api/v1/insights/explain-chart", body);
      section.narration = data.explanation;
      // A cached answer cost no tokens, so the pacing delay can be skipped.
      section._cached = data.cached === true;
    } catch (err) {
      const detail = (err.response && err.response.data && err.response.data.detail) || err.message;
      console.error("[report] narration for " + section.id + " failed:", detail);
      // A missing explanation must never cost the reader the chart.
      section.narrationError = "Explanation unavailable for this section.";
    }
    // Only pace after a call that actually spent tokens.
    if (i < sections.length - 1 && !section._cached) await sleep(NARRATION_GAP_MS);
  }

  console.log(`[report] narration finished in ${Date.now() - startedAt}ms`);
  return sections;
}

module.exports = {
  buildSections, BUILDERS,
  eggSection, fcrSection, funnelSection, revenueSection,
  AVG_EGG_MASS_KG, FCR_BENCHMARK,
};
