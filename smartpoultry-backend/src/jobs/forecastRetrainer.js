/**
 * Weekly Prophet retrain scheduler.
 *
 * Every Sunday at 03:00 (server local time) this job POSTs to the AI
 * microservice's /api/v1/forecast/retrain endpoint so the demand-forecast
 * model always reflects the last 180 days of orders.
 *
 * Config:
 *   WEEKLY_RETRAIN_ENABLED   set to "false" to disable (default: enabled)
 *   WEEKLY_RETRAIN_CRON      cron expression, defaults to "0 3 * * 0"
 *
 * Uses the shared aiClient (X-API-Key + timeout) rather than raw axios so
 * failures surface with the same envelope as manual /api/ai/* calls.
 */

const cron = require("node-cron")
const aiClient = require("../config/aiClient")

const DEFAULT_SCHEDULE = "0 3 * * 0" // Sunday 03:00

async function runRetrain() {
  const startedAt = new Date().toISOString()
  console.log(`[forecast-retrain] ${startedAt} — triggering AI retrain…`)
  try {
    const { data } = await aiClient.post("/api/v1/forecast/retrain")
    console.log(
      `[forecast-retrain] done — MAPE ${data?.metrics?.mape ?? "n/a"} · ` +
        `RMSE ${data?.metrics?.rmse ?? "n/a"} · ${data?.metrics?.n_train ?? "?"} train rows`
    )
  } catch (err) {
    const msg = err.response?.data?.detail || err.message || "unknown"
    console.error(`[forecast-retrain] FAILED: ${msg}`)
  }
}

function registerWeeklyRetrain() {
  if (process.env.WEEKLY_RETRAIN_ENABLED === "false") {
    console.log("[forecast-retrain] disabled via WEEKLY_RETRAIN_ENABLED=false")
    return
  }
  const schedule = process.env.WEEKLY_RETRAIN_CRON || DEFAULT_SCHEDULE
  if (!cron.validate(schedule)) {
    console.warn(`[forecast-retrain] invalid cron expression "${schedule}" — job NOT scheduled`)
    return
  }
  cron.schedule(schedule, runRetrain, { timezone: process.env.TZ || undefined })
  console.log(`[forecast-retrain] scheduled — cron="${schedule}" tz="${process.env.TZ || "system"}"`)
}

module.exports = { registerWeeklyRetrain, runRetrain }
