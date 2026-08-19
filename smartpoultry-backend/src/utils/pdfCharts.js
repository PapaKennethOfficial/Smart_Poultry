/**
 * Vector chart primitives drawn straight into a pdfkit document.
 *
 * Why not a chart library: chartjs-node-canvas and friends depend on `canvas`,
 * a native module needing a C++ toolchain that routinely fails to install on
 * Windows. pdfkit's own path API needs no extra dependency, and the output is
 * true vector — sharp at any zoom, unlike an embedded PNG.
 *
 * Every function takes (doc, opts) and RETURNS the y coordinate just below what
 * it drew, so callers can stack sections without tracking heights.
 *
 * These are PRINT colours for a white page, deliberately darker than the
 * on-screen palette which was chosen for a dark background.
 */

const PALETTE = {
  primary: "#1b7a2b",
  secondary: "#6b46c1",
  accent: "#a06800",
  teal: "#0f7f81",
  danger: "#c0392b",
  ink: "#1a1a1a",
  muted: "#6b7280",
  grid: "#e5e7eb",
  axis: "#9ca3af",
};

/** Round an axis maximum up to a friendly number so ticks read cleanly. */
function niceMax(value) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const mag = Math.pow(10, exp);
  const norm = value / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}

function fmt(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  const abs = Math.abs(n);
  if (abs >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (abs >= 1000) return (n / 1000).toFixed(1) + "k";
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/** Shared frame: gridlines, y ticks, x labels. No vertical rules — they
 *  compete with the data marks for attention. */
function drawFrame(doc, { x, y, width, height, maxY, xLabels, yTicks = 4 }) {
  const bottom = y + height;
  doc.save();
  for (let i = 0; i <= yTicks; i++) {
    const gy = bottom - (height * i) / yTicks;
    doc.strokeColor(PALETTE.grid).lineWidth(0.5).moveTo(x, gy).lineTo(x + width, gy).stroke();
    doc.fillColor(PALETTE.muted).fontSize(7)
      .text(fmt((maxY * i) / yTicks), x - 40, gy - 3.5, { width: 36, align: "right" });
  }
  doc.strokeColor(PALETTE.axis).lineWidth(0.8).moveTo(x, bottom).lineTo(x + width, bottom).stroke();
  if (xLabels && xLabels.length) {
    const step = Math.max(1, Math.ceil(xLabels.length / 8));
    const slot = width / xLabels.length;
    xLabels.forEach((label, i) => {
      if (i % step !== 0) return;
      doc.fillColor(PALETTE.muted).fontSize(6.5)
        .text(String(label), x + slot * i - slot / 2, bottom + 5,
          { width: slot * 2, align: "center", lineBreak: false });
    });
  }
  doc.restore();
  return bottom;
}

function emptyPlot(doc, { x, y, width, height, message }) {
  doc.save();
  doc.rect(x, y, width, height).strokeColor(PALETTE.grid).lineWidth(0.8)
    .dash(3, { space: 3 }).stroke().undash();
  doc.fillColor(PALETTE.muted).fontSize(9)
    .text(message, x, y + height / 2 - 5, { width, align: "center" });
  doc.restore();
  return y + height + 16;
}

/** The AI narration block that sits under a chart. */
function drawCaption(doc, text, x, y, width) {
  doc.save();
  const padding = 8;
  const textWidth = width - padding * 2;
  doc.fontSize(8.5).font("Helvetica-Oblique");
  const h = doc.heightOfString(text, { width: textWidth, lineGap: 1.5 }) + padding * 2;
  doc.rect(x, y, width, h).fillColor("#f6faf6").fill();
  doc.rect(x, y, 2.5, h).fillColor(PALETTE.primary).fill();
  doc.fillColor("#374151").text(text, x + padding, y + padding, { width: textWidth, lineGap: 1.5 });
  doc.font("Helvetica").restore();
  return y + h + 14;
}

/** Line chart with an optional filled area. data: [{ label, value }] */
function lineChart(doc, opts) {
  const { x = 60, y, width = 460, height = 150, data = [],
          color = PALETTE.primary, fill = true, caption } = opts;
  if (!data.length) {
    return emptyPlot(doc, { x, y, width, height, message: "No data recorded for this period." });
  }
  const values = data.map((d) => Number(d.value) || 0);
  const maxY = niceMax(Math.max(...values, 1));
  const bottom = drawFrame(doc, { x, y, width, height, maxY, xLabels: data.map((d) => d.label) });
  const slot = data.length > 1 ? width / (data.length - 1) : width;
  const px = (i) => (data.length === 1 ? x + width / 2 : x + slot * i);
  const py = (v) => bottom - (v / maxY) * height;

  doc.save();
  if (fill && data.length > 1) {
    doc.moveTo(px(0), bottom);
    values.forEach((v, i) => doc.lineTo(px(i), py(v)));
    doc.lineTo(px(values.length - 1), bottom).closePath()
      .fillColor(color).fillOpacity(0.12).fill().fillOpacity(1);
  }
  doc.strokeColor(color).lineWidth(1.6);
  values.forEach((v, i) => (i === 0 ? doc.moveTo(px(i), py(v)) : doc.lineTo(px(i), py(v))));
  doc.stroke();
  if (data.length <= 20) {
    values.forEach((v, i) => doc.circle(px(i), py(v), 2).fillColor(color).fill());
  }
  doc.restore();

  let next = bottom + 22;
  if (caption) next = drawCaption(doc, caption, x, next, width);
  return next;
}

/** Vertical bars with an optional benchmark rule. data: [{ label, value }] */
function barChart(doc, opts) {
  const { x = 60, y, width = 460, height = 150, data = [],
          color = PALETTE.primary, benchmark = null,
          benchmarkLabel = "Benchmark", caption } = opts;
  const usable = data.filter((d) => d.value !== null && d.value !== undefined);
  if (!usable.length) {
    return emptyPlot(doc, { x, y, width, height, message: "No data recorded for this period." });
  }
  const values = usable.map((d) => Number(d.value) || 0);
  const maxY = niceMax(Math.max(...values, benchmark || 0, 1));
  const bottom = drawFrame(doc, { x, y, width, height, maxY, xLabels: usable.map((d) => d.label) });
  const slot = width / usable.length;
  const barW = Math.min(34, slot * 0.55);

  doc.save();
  values.forEach((v, i) => {
    const h = (v / maxY) * height;
    const bx = x + slot * i + (slot - barW) / 2;
    doc.rect(bx, bottom - h, barW, h).fillColor(color).fill();
    if (usable.length <= 12) {
      doc.fillColor(PALETTE.muted).fontSize(6.5)
        .text(fmt(v), bx - 6, bottom - h - 10,
          { width: barW + 12, align: "center", lineBreak: false });
    }
  });
  if (benchmark !== null && Number.isFinite(benchmark)) {
    const by = bottom - (benchmark / maxY) * height;
    doc.strokeColor(PALETTE.danger).lineWidth(1).dash(3, { space: 2 })
      .moveTo(x, by).lineTo(x + width, by).stroke().undash();
    doc.fillColor(PALETTE.danger).fontSize(6.5)
      .text(benchmarkLabel + " (" + benchmark + ")", x + width - 110, by - 9,
        { width: 108, align: "right" });
  }
  doc.restore();

  let next = bottom + 22;
  if (caption) next = drawCaption(doc, caption, x, next, width);
  return next;
}

/** Horizontal funnel. Bars are proportional to the FIRST stage, so the
 *  taper is honest and a widening funnel would be visibly wrong. */
function funnelChart(doc, opts) {
  const { x = 60, y, width = 460, data = [], caption } = opts;
  if (!data.length) {
    return emptyPlot(doc, { x, y, width, height: 100, message: "No orders in this period." });
  }
  const top = data[0] && data[0].count ? data[0].count : 1;
  const rowH = 22, gap = 6, labelW = 78;
  const barMax = width - labelW - 60;

  doc.save();
  data.forEach((row, i) => {
    const ry = y + i * (rowH + gap);
    const pct = top > 0 ? row.count / top : 0;
    doc.fillColor(PALETTE.ink).fontSize(8).text(row.stage, x, ry + 6, { width: labelW });
    doc.rect(x + labelW, ry, barMax, rowH).fillColor("#f3f4f6").fill();
    doc.rect(x + labelW, ry, Math.max(1, barMax * pct), rowH).fillColor(PALETTE.primary).fill();
    doc.fillColor(PALETTE.ink).fontSize(8)
      .text(row.count + "  (" + Math.round(pct * 100) + "%)",
        x + labelW + barMax + 6, ry + 6, { width: 56, lineBreak: false });
  });
  doc.restore();

  let next = y + data.length * (rowH + gap) + 10;
  if (caption) next = drawCaption(doc, caption, x, next, width);
  return next;
}

/** Data table. columns: [{ header, key, width, align }] */
function table(doc, { x = 60, y, columns, rows, maxRows = 25 }) {
  const rowH = 16;
  const shown = rows.slice(0, maxRows);
  const totalW = columns.reduce((s, c) => s + c.width, 0);

  doc.save();
  doc.rect(x, y, totalW, rowH).fillColor("#f3f4f6").fill();
  let cx = x;
  doc.fontSize(7.5).font("Helvetica-Bold").fillColor(PALETTE.ink);
  columns.forEach((c) => {
    doc.text(c.header, cx + 4, y + 5,
      { width: c.width - 8, align: c.align || "left", lineBreak: false });
    cx += c.width;
  });

  doc.font("Helvetica").fontSize(7.5);
  shown.forEach((row, i) => {
    const ry = y + rowH * (i + 1);
    if (i % 2 === 1) doc.rect(x, ry, totalW, rowH).fillColor("#fafafa").fill();
    cx = x;
    columns.forEach((c) => {
      const raw = row[c.key];
      doc.fillColor("#374151")
        .text(raw === null || raw === undefined ? "-" : String(raw), cx + 4, ry + 5,
          { width: c.width - 8, align: c.align || "left", lineBreak: false });
      cx += c.width;
    });
  });
  doc.restore();

  let next = y + rowH * (shown.length + 1) + 8;
  if (rows.length > maxRows) {
    doc.fontSize(7).fillColor(PALETTE.muted)
      .text("Showing " + maxRows + " of " + rows.length + " rows. Export CSV for the full set.", x, next);
    next += 12;
  }
  return next + 6;
}

module.exports = {
  PALETTE, niceMax, fmt, drawFrame, emptyPlot, drawCaption,
  lineChart, barChart, funnelChart, table,
};
