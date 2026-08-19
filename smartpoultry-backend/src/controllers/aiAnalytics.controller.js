/**
 * Gateway controllers that forward requests from the browser to the
 * SmartPoultry AI microservice (FastAPI + Prophet + OR-Tools). Every
 * error from the Python service is normalised into a friendly JSON
 * envelope so the frontend doesn't have to know about the two-hop
 * architecture.
 */

const prisma = require("../config/prisma")
const aiClient = require("../config/aiClient")

// ─── Shared helper — translate axios failures into HTTP responses ──────────
function forwardAiError(err, res, fallbackMessage) {
  // Always log the upstream failure. Without this the only trace of a bad
  // Groq model name or a Prophet crash was a status code on the client.
  if (err.response) {
    console.error(
      `[ai-gateway] ${err.config?.method?.toUpperCase() || "?"} ${err.config?.url || "?"} ` +
      `-> ${err.response.status}`,
      typeof err.response.data === "object"
        ? JSON.stringify(err.response.data).slice(0, 600)
        : String(err.response.data).slice(0, 600)
    )
  } else {
    console.error(
      `[ai-gateway] ${err.config?.url || "?"} failed with no response:`,
      err.code || err.message
    )
  }

  if (err.response) {
    // AI service returned a structured error — forward its status and body.
    return res.status(err.response.status).json({
      message: err.response.data?.detail || err.response.data?.message || fallbackMessage,
      source: "ai-service",
    })
  }
  // Network / timeout / config error — the AI service is down or misconfigured.
  const message = err.code === "ECONNREFUSED"
    ? "AI service is not reachable. Make sure smartpoultry-ai is running."
    : err.message || fallbackMessage
  return res.status(503).json({ message, source: "gateway" })
}

// ─── GET /api/ai/forecast/demand?days=14 ──────────────────────────────────
// Proxies to GET /api/v1/forecast/demand on the Python service.
const getDemandForecast = async (req, res, next) => {
  try {
    const params = {}
    if (req.query.days) params.days = req.query.days
    const { data } = await aiClient.get("/api/v1/forecast/demand", { params })
    res.status(200).json(data)
  } catch (err) {
    return forwardAiError(err, res, "Failed to fetch demand forecast")
  }
}

// ─── GET /api/ai/forecast/eggs?days=14 ────────────────────────────────────
// Prophet forecast of EGG PRODUCTION (from LogEntry), as opposed to /demand
// which forecasts customer orders. Putting the two on one chart is what shows
// whether the farm is over- or under-producing against what customers want.
const getEggForecast = async (req, res, next) => {
  try {
    const params = {}
    if (req.query.days) params.days = req.query.days
    const { data } = await aiClient.get("/api/v1/forecast/eggs", { params })
    res.status(200).json(data)
  } catch (err) {
    return forwardAiError(err, res, "Failed to fetch egg production forecast")
  }
}

// ─── GET /api/ai/forecast/series ──────────────────────────────────────────
// Which series the AI service can model. Lets the UI build its selector
// without hardcoding names.
const getForecastSeries = async (req, res, next) => {
  try {
    const { data } = await aiClient.get("/api/v1/forecast/series")
    res.status(200).json(data)
  } catch (err) {
    return forwardAiError(err, res, "Failed to list forecast series")
  }
}

// ─── POST /api/ai/forecast/retrain ────────────────────────────────────────
// MANAGER/ADMIN only — used by a UI button or a nightly cron.
const retrainForecast = async (req, res, next) => {
  try {
    // No `series` param retrains every registered series.
    const params = {}
    if (req.query.series) params.series = req.query.series
    const { data } = await aiClient.post("/api/v1/forecast/retrain", {}, { params })
    res.status(200).json(data)
  } catch (err) {
    return forwardAiError(err, res, "Failed to retrain forecast model")
  }
}

// ─── POST /api/ai/routes/optimize ─────────────────────────────────────────
// Convenience wrapper: if the caller sends `{ orderIds: [...] }` we look up
// the corresponding DeliveryOrder rows and build the stops list from them.
// If the caller supplies a full `{ depot, stops, vehicles }` payload we
// forward it verbatim.
const optimizeRoutes = async (req, res, next) => {
  try {
    let payload = req.body

    // Sugar mode — orderIds only. Auto-build stops from DB, use approved
    // active drivers as vehicles, and take the depot from FARM_DEPOT_LAT/LON.
    if (payload && Array.isArray(payload.orderIds) && !payload.stops) {
      const depotLat = Number(process.env.FARM_DEPOT_LAT)
      const depotLon = Number(process.env.FARM_DEPOT_LON)
      if (!Number.isFinite(depotLat) || !Number.isFinite(depotLon)) {
        return res.status(400).json({
          message: "FARM_DEPOT_LAT / FARM_DEPOT_LON must be configured for orderIds mode",
        })
      }

      const orders = await prisma.deliveryOrder.findMany({
        where: { id: { in: payload.orderIds } },
        select: {
          id: true,
          orderId: true,
          quantity: true,
          deliveryLatitude: true,
          deliveryLongitude: true,
        },
      })
      const stops = orders
        .filter((o) => o.deliveryLatitude != null && o.deliveryLongitude != null)
        .map((o) => ({
          id: o.orderId || o.id,
          lat: o.deliveryLatitude,
          lon: o.deliveryLongitude,
          demand: Math.max(1, Math.round(o.quantity || 1)),
        }))

      if (stops.length === 0) {
        return res.status(422).json({
          message: "None of the supplied orders have delivery coordinates",
        })
      }

      // Default fleet: one uncapped vehicle unless the caller specified otherwise.
      const vehicles = Array.isArray(payload.vehicles) && payload.vehicles.length > 0
        ? payload.vehicles
        : [{ id: "vehicle-1", capacity: 999999 }]

      payload = {
        depot: { id: "depot", lat: depotLat, lon: depotLon, demand: 0 },
        stops,
        vehicles,
        time_limit_seconds: payload.time_limit_seconds || 5,
      }
    }

    const { data } = await aiClient.post("/api/v1/routes/optimize", payload)
    res.status(200).json(data)
  } catch (err) {
    return forwardAiError(err, res, "Failed to optimise routes")
  }
}

// ─── POST /api/ai/insights/morning-briefing ───────────────────────────────
// LLM-generated executive summary of the trailing week. No body required.
const getMorningBriefing = async (req, res, next) => {
  try {
    const params = {}
    if (req.query.days) params.days = req.query.days
    const { data } = await aiClient.post("/api/v1/insights/morning-briefing", {}, { params })
    res.status(200).json(data)
  } catch (err) {
    return forwardAiError(err, res, "Failed to generate morning briefing")
  }
}

// ─── POST /api/ai/insights/ask ────────────────────────────────────────────
// Body: { question: string }. Ask-the-data endpoint.
const askInsight = async (req, res, next) => {
  try {
    const question = (req.body && req.body.question) || ""
    if (!question || typeof question !== "string") {
      return res.status(400).json({ message: "`question` is required" })
    }
    // `days` lets the manager widen the window past the default 7.
    const days = Number(req.body?.days)
    const payload = { question }
    if (Number.isFinite(days) && days >= 1 && days <= 365) payload.days = Math.round(days)
    const { data } = await aiClient.post("/api/v1/insights/ask", payload)
    res.status(200).json(data)
  } catch (err) {
    return forwardAiError(err, res, "Failed to answer question")
  }
}

// ─── POST /api/ai/insights/explain-chart ──────────────────────────────────
// Body: { chartId, window? }. Explains ONE chart using that chart's actual
// current data, recomputed server-side.
const explainChart = async (req, res, next) => {
  try {
    const chartId = req.body?.chartId || req.body?.chart_id
    if (!chartId || typeof chartId !== "string") {
      return res.status(400).json({ message: "`chartId` is required" })
    }
    const payload = { chart_id: chartId }
    const w = Number(req.body?.window)
    if (Number.isFinite(w) && w >= 1 && w <= 365) payload.window = Math.round(w)
    // "Regenerate" bypasses the AI service's explanation cache.
    if (req.body?.refresh === true) payload.refresh = true

    const { data } = await aiClient.post("/api/v1/insights/explain-chart", payload)
    res.status(200).json(data)
  } catch (err) {
    return forwardAiError(err, res, "Failed to explain chart")
  }
}

// ─── GET /api/ai/insights/charts ──────────────────────────────────────────
const listExplainableCharts = async (req, res, next) => {
  try {
    const { data } = await aiClient.get("/api/v1/insights/charts")
    res.status(200).json(data)
  } catch (err) {
    return forwardAiError(err, res, "Failed to list explainable charts")
  }
}

// ─── GET /api/ai/forecast/diagnostics ─────────────────────────────────────
// Why is the forecast degraded? Returns the real Prophet/cmdstan error.
const getForecastDiagnostics = async (req, res, next) => {
  try {
    const { data } = await aiClient.get("/api/v1/forecast/diagnostics")
    res.status(200).json(data)
  } catch (err) {
    return forwardAiError(err, res, "Failed to run forecast diagnostics")
  }
}

module.exports = {
  getForecastDiagnostics,
  explainChart,
  listExplainableCharts,
  getDemandForecast,
  getEggForecast,
  getForecastSeries,
  retrainForecast,
  optimizeRoutes,
  getMorningBriefing,
  askInsight,
}
