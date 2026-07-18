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

// ─── POST /api/ai/forecast/retrain ────────────────────────────────────────
// MANAGER/ADMIN only — used by a UI button or a nightly cron.
const retrainForecast = async (req, res, next) => {
  try {
    const { data } = await aiClient.post("/api/v1/forecast/retrain")
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
    const { data } = await aiClient.post("/api/v1/insights/morning-briefing")
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
    const { data } = await aiClient.post("/api/v1/insights/ask", { question })
    res.status(200).json(data)
  } catch (err) {
    return forwardAiError(err, res, "Failed to answer question")
  }
}

module.exports = {
  getDemandForecast,
  retrainForecast,
  optimizeRoutes,
  getMorningBriefing,
  askInsight,
}
