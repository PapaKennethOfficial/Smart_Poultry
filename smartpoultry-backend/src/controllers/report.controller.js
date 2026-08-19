const prisma = require("../config/prisma");
const PDFDocument = require("pdfkit");
const { createObjectCsvWriter } = require("csv-writer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const charts = require("../utils/pdfCharts");
const { buildSections, AVG_EGG_MASS_KG, FCR_BENCHMARK } = require("../services/reportSections.service");

// ─── Constants ────────────────────────────────────────────────────────────────

const REPORTS_DIR = path.join(__dirname, "..", "..", "uploads", "reports");

// Ensure output directory exists at startup
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map a date-range keyword to concrete start/end dates */
function getDateRange(range) {
  const end = new Date();
  const start = new Date();

  switch (range) {
    case "week":
      start.setDate(start.getDate() - 7);
      break;
    case "month":
      start.setDate(start.getDate() - 30);
      break;
    case "quarter":
      start.setMonth(start.getMonth() - 3);
      break;
    default:
      start.setDate(start.getDate() - 7);
  }

  return { start, end };
}

/** Query LogEntry rows for a given date range */
async function queryReportData(type, start, end) {
  return prisma.logEntry.findMany({
    where: {
      date: { gte: start, lte: end },
    },
    include: {
      batch: { select: { batchNumber: true, breed: true } },
      loggedBy: { select: { name: true } },
    },
    orderBy: { date: "desc" },
  });
}

/** Generate a unique filename for a report */
function makeFilename(type, ext) {
  const stamp = Date.now();
  const rand = crypto.randomBytes(3).toString("hex");
  return `${type}_${stamp}_${rand}.${ext}`;
}

// ─── PDF Generator ────────────────────────────────────────────────────────────

function generatePDF(data, type, dateRange, sections = []) {
  return new Promise((resolve, reject) => {
    const filename = makeFilename(type, "pdf");
    const filepath = path.join(REPORTS_DIR, filename);
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filepath);

    doc.pipe(stream);

    // ── Title block
    doc
      .fontSize(22)
      .font("Helvetica-Bold")
      .text("SmartPoultry Report", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(11).font("Helvetica").fillColor("#555555");
    doc.text(
      `Type: ${type.charAt(0).toUpperCase() + type.slice(1)}  |  Range: ${dateRange}  |  Generated: ${new Date().toLocaleDateString()}`,
      { align: "center" }
    );
    doc.moveDown(0.8);
    doc
      .moveTo(50, doc.y)
      .lineTo(doc.page.width - 50, doc.y)
      .strokeColor("#237227")
      .lineWidth(1.5)
      .stroke();
    doc.moveDown(1);

    // ── Summary
    const totalFeed = data.reduce((s, e) => s + (e.feedConsumption || 0), 0);
    const totalEggs = data.reduce((s, e) => s + (e.eggsCount || 0), 0);
    const totalMortality = data.reduce((s, e) => s + (e.mortality || 0), 0);
    const totalWater = data.reduce((s, e) => s + (e.waterConsumption || 0), 0);

    doc.fontSize(14).font("Helvetica-Bold").fillColor("#000000").text("Summary");
    doc.moveDown(0.4);
    doc.fontSize(10).font("Helvetica").fillColor("#333333");
    doc.text(`Total Log Entries: ${data.length}`);
    doc.text(`Total Eggs Collected: ${totalEggs.toLocaleString()}`);
    doc.text(`Total Feed Consumed: ${totalFeed.toFixed(1)} kg`);
    doc.text(`Total Water Consumed: ${totalWater.toFixed(1)} L`);
    doc.text(`Total Mortality: ${totalMortality}`);
    // FCR is kg feed per kg of EGGS, not per egg. Dividing feed mass by an egg
    // count produced a meaningless ~0.10 that was then compared to the 2.3
    // mass-ratio benchmark elsewhere in the app.
    const eggMassKg = totalEggs * AVG_EGG_MASS_KG;
    if (eggMassKg > 0) {
      const fcr = totalFeed / eggMassKg;
      doc.text(
        `Feed Conversion Ratio: ${fcr.toFixed(2)} kg feed / kg eggs ` +
        `(benchmark ${FCR_BENCHMARK}, lower is better)`
      );
    }
    doc.moveDown(1);

    // ── Visual sections: chart, then plain-language explanation, then data
    const CONTENT_X = 90;                     // leaves room for y-axis labels
    const CONTENT_W = doc.page.width - CONTENT_X - 50;

    for (const section of sections) {
      // Start each section on a fresh page when the current one is nearly full.
      if (doc.y > doc.page.height - 300) doc.addPage();

      doc.fontSize(14).font("Helvetica-Bold").fillColor("#000000")
        .text(section.title, 50, doc.y);
      doc.moveDown(0.3);

      if (section.summary) {
        doc.fontSize(9).font("Helvetica").fillColor("#4b5563");
        const line = Object.entries(section.summary)
          .map(([k, v]) => `${k}: ${v}`).join("   |   ");
        doc.text(line, 50, doc.y);
        doc.moveDown(0.5);
      }

      const caption = section.narration || section.narrationError || null;
      const chartTop = doc.y + 6;
      let nextY;

      if (section.chart.type === "line") {
        nextY = charts.lineChart(doc, {
          x: CONTENT_X, y: chartTop, width: CONTENT_W, height: 140,
          data: section.chart.data, caption,
        });
      } else if (section.chart.type === "bar") {
        nextY = charts.barChart(doc, {
          x: CONTENT_X, y: chartTop, width: CONTENT_W, height: 140,
          data: section.chart.data,
          benchmark: section.chart.benchmark,
          benchmarkLabel: section.chart.benchmarkLabel,
          caption,
        });
      } else if (section.chart.type === "funnel") {
        nextY = charts.funnelChart(doc, {
          x: 50, y: chartTop, width: CONTENT_W + 40,
          data: section.chart.data, caption,
        });
      } else {
        nextY = chartTop;
      }

      doc.y = nextY;

      if (section.table && section.table.rows.length) {
        if (doc.y > doc.page.height - 160) doc.addPage();
        doc.y = charts.table(doc, {
          x: 50, y: doc.y,
          columns: section.table.columns,
          rows: section.table.rows,
          maxRows: 20,
        });
      }

      doc.moveDown(1);
    }

    // ── Raw log table
    if (doc.y > doc.page.height - 200) doc.addPage();
    doc.fontSize(14).font("Helvetica-Bold").fillColor("#000000").text("Daily Log Details", 50, doc.y);
    doc.moveDown(0.5);

    const headers = ["Date", "Batch", "Eggs", "Feed (kg)", "Water (L)", "Mortality", "Temp"];
    const colWidths = [75, 95, 55, 65, 65, 65, 55];
    let tableY = doc.y + 4;
    let x = 50;

    doc.fontSize(8).font("Helvetica-Bold").fillColor("#0a260d");
    headers.forEach((h, i) => {
      doc.text(h, x, tableY, { width: colWidths[i], align: "left" });
      x += colWidths[i];
    });
    doc
      .moveTo(50, tableY + 12)
      .lineTo(50 + colWidths.reduce((a, b) => a + b, 0), tableY + 12)
      .strokeColor("#cccccc")
      .lineWidth(0.5)
      .stroke();

    let rowY = tableY + 16;
    doc.font("Helvetica").fontSize(8).fillColor("#333333");

    data.slice(0, 80).forEach((entry) => {
      if (rowY > doc.page.height - 60) {
        doc.addPage();
        rowY = 50;
      }
      x = 50;
      const row = [
        new Date(entry.date).toLocaleDateString(),
        entry.batch?.batchNumber || "—",
        String(entry.eggsCount || 0),
        (entry.feedConsumption || 0).toFixed(1),
        (entry.waterConsumption || 0).toFixed(1),
        String(entry.mortality || 0),
        entry.temperature != null ? `${entry.temperature.toFixed(1)}°C` : "—",
      ];
      row.forEach((val, i) => {
        doc.text(val, x, rowY, { width: colWidths[i], align: "left" });
        x += colWidths[i];
      });
      rowY += 13;
    });

    // ── Footer
    doc.moveDown(2);
    doc
      .fontSize(8)
      .fillColor("#999999")
      .text("Generated by SmartPoultry — Intelligent Farm Management", 50, doc.page.height - 40, {
        align: "center",
        width: doc.page.width - 100,
      });

    doc.end();

    stream.on("finish", () => resolve({ filename, filepath }));
    stream.on("error", reject);
  });
}

// ─── CSV Generator ────────────────────────────────────────────────────────────

async function generateCSV(data, type) {
  const filename = makeFilename(type, "csv");
  const filepath = path.join(REPORTS_DIR, filename);

  const csvWriter = createObjectCsvWriter({
    path: filepath,
    header: [
      { id: "date", title: "Date" },
      { id: "batch", title: "Batch" },
      { id: "breed", title: "Breed" },
      { id: "eggsCount", title: "Eggs" },
      { id: "feedConsumption", title: "Feed (kg)" },
      { id: "waterConsumption", title: "Water (L)" },
      { id: "mortality", title: "Mortality" },
      { id: "avgWeight", title: "Avg Weight (kg)" },
      { id: "temperature", title: "Temperature (°C)" },
      { id: "humidity", title: "Humidity (%)" },
      { id: "loggedBy", title: "Logged By" },
    ],
  });

  const records = data.map((e) => ({
    date: new Date(e.date).toLocaleDateString(),
    batch: e.batch?.batchNumber || "—",
    breed: e.batch?.breed || "—",
    eggsCount: e.eggsCount || 0,
    feedConsumption: (e.feedConsumption || 0).toFixed(1),
    waterConsumption: (e.waterConsumption || 0).toFixed(1),
    mortality: e.mortality || 0,
    avgWeight: e.avgWeight != null ? e.avgWeight.toFixed(2) : "—",
    temperature: e.temperature != null ? e.temperature.toFixed(1) : "—",
    humidity: e.humidity != null ? e.humidity.toFixed(1) : "—",
    loggedBy: e.loggedBy?.name || "—",
  }));

  await csvWriter.writeRecords(records);
  return { filename, filepath };
}

// ─── POST /reports ────────────────────────────────────────────────────────────

const generateReportHandler = async (req, res, next) => {
  try {
    const { type, dateRange, format } = req.body;
    // Visuals and narration are on by default; either can be turned off, which
    // matters when the LLM is unavailable or its rate limit is tight.
    const includeVisuals = req.body.includeVisuals !== false;
    const includeNarration = req.body.includeNarration !== false;

    // Strict input validation to prevent invalid ranges, format errors, and path traversal
    const allowedTypes = ["production", "financial", "delivery", "analytics"];
    const allowedRanges = ["week", "month", "quarter"];
    const allowedFormats = ["pdf", "csv"];

    if (!type || !dateRange || !format) {
      return res.status(400).json({ error: "type, dateRange, and format are required" });
    }

    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid report type. Allowed: ${allowedTypes.join(", ")}` });
    }

    if (!allowedRanges.includes(dateRange)) {
      return res.status(400).json({ error: `Invalid date range. Allowed: ${allowedRanges.join(", ")}` });
    }

    if (!allowedFormats.includes(format.toLowerCase())) {
      return res.status(400).json({ error: `Invalid format. Allowed: ${allowedFormats.join(", ")}` });
    }

    const { start, end } = getDateRange(dateRange);
    const data = await queryReportData(type, start, end);

    const windowDays =
      dateRange === "quarter" ? 90 : dateRange === "month" ? 30 : 7;

    // Generate file
    let result;
    if (format === "csv") {
      result = await generateCSV(data, type);
    } else {
      // Build the visual sections first. Narration is sequential and rate
      // limited, so this is the slow part of a report — typically a few
      // seconds per section. Failures degrade to chart-plus-table.
      let sections = [];
      if (includeVisuals) {
        try {
          sections = await buildSections(start, end, {
            narrate: includeNarration,
            windowDays,
          });
        } catch (err) {
          console.error("[report] section build failed:", err.message);
        }
      }
      result = await generatePDF(data, type, dateRange, sections);
    }

    const fileUrl = `/uploads/reports/${result.filename}`;

    // Persist report record — link to user's first farm
    const farm = await prisma.farm.findFirst({ where: { userId: req.user.id } });

    if (farm) {
      await prisma.report.create({
        data: {
          farmId: farm.id,
          userId: req.user.id,
          type: "CUSTOM",
          title: `${type.charAt(0).toUpperCase() + type.slice(1)} Report — ${dateRange}`,
          content: {
            dateRange, format, entriesCount: data.length,
            includeVisuals, includeNarration,
          },
          fileUrl,
          format: format.toUpperCase(),
          startDate: start,
          endDate: end,
        },
      });
    }

    res.json({ fileUrl });
  } catch (error) {
    next(error);
  }
};

// ─── GET /reports/history ─────────────────────────────────────────────────────

const getReportHistory = async (req, res, next) => {
  try {
    const reports = await prisma.report.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        generatedBy: { select: { name: true } },
      },
    });

    res.json(
      reports.map((r) => ({
        id: r.id,
        title: r.title,
        type: r.type,
        format: r.format || "PDF",
        fileUrl: r.fileUrl,
        createdAt: r.createdAt,
        generatedBy: r.generatedBy?.name || "System",
      }))
    );
  } catch (error) {
    next(error);
  }
};

// ─── GET /logs/audit ──────────────────────────────────────────────────────────

const getAuditLogs = async (req, res, next) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        user: { select: { name: true } },
      },
    });

    res.json(
      logs.map((l) => ({
        id: l.id,
        action: l.action,
        endpoint: l.endpoint,
        entity: l.entity,
        user: l.user?.name || "System",
        createdAt: l.createdAt,
      }))
    );
  } catch (error) {
    next(error);
  }
};

module.exports = { generateReport: generateReportHandler, getReportHistory, getAuditLogs };
