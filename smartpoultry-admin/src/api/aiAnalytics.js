import api from './axios'

/**
 * GET /api/ai/forecast/demand?days=N
 * Proxies to the Python microservice's Prophet forecast.
 * @param {{ days?: number }} [params]
 * @returns {Promise<{
 *   history: Array<{ ds: string, y: number }>,
 *   forecast: Array<{ ds: string, yhat: number, yhat_lower: number, yhat_upper: number }>,
 *   metrics: { mape?: number|null, rmse?: number|null, n_train?: number, n_holdout?: number, note?: string, warnings?: string[] },
 *   trained_at: string,
 *   cache_hit: boolean,
 * }>}
 */
export const getDemandForecast = ({ days = 14 } = {}) =>
  api.get('/api/ai/forecast/demand', { params: { days } }).then((res) => res.data)

/**
 * GET /api/ai/forecast/eggs?days=N
 * Prophet forecast of EGG PRODUCTION, same response shape as the demand
 * forecast. Pair the two to see supply against demand on one axis.
 * @returns {Promise<{ series, label, unit, history, forecast, metrics, trained_at, cache_hit }>}
 */
export const getEggForecast = ({ days = 14 } = {}) =>
  api.get('/api/ai/forecast/eggs', { params: { days } }).then((res) => res.data)

/**
 * GET /api/ai/forecast/series — which series the AI service can model.
 */
export const getForecastSeries = () =>
  api.get('/api/ai/forecast/series').then((res) => res.data)

/**
 * POST /api/ai/forecast/retrain — force a fresh model train.
 * Omit `series` to retrain every series.
 */
export const retrainDemandForecast = (series) =>
  api.post('/api/ai/forecast/retrain', {}, { params: series ? { series } : {} })
    .then((res) => res.data)

/**
 * POST /api/ai/routes/optimize
 *
 * Two payload shapes are accepted server-side:
 *   1. Full VRP: { depot, stops, vehicles, time_limit_seconds }
 *   2. Sugar:    { orderIds: [...], vehicles? } — depot auto-injected
 *                from FARM_DEPOT_LAT/LON, stops built from DB.
 */
export const optimizeRoutes = (payload) =>
  api.post('/api/ai/routes/optimize', payload).then((res) => res.data)

/**
 * POST /api/ai/insights/morning-briefing
 * @returns {Promise<{ text: string, model: string, generated_at: string, context: object }>}
 */
export const getMorningBriefing = ({ days } = {}) =>
  api.post('/api/ai/insights/morning-briefing', {}, { params: days ? { days } : {} })
    .then((res) => res.data)

/**
 * POST /api/ai/insights/ask
 * @param {string} question — free-text question from the manager
 * @returns {Promise<{ question: string, answer: string, model: string, generated_at: string }>}
 */
export const askInsight = (question, { days } = {}) =>
  api.post('/api/ai/insights/ask', days ? { question, days } : { question })
    .then((res) => res.data)

/**
 * POST /api/ai/insights/explain-chart
 * Explain ONE chart in plain language, using its actual current data.
 * The server recomputes the numbers — we only send an id and a window.
 * @param {string} chartId  e.g. 'egg_trend', 'fcr', 'demand_forecast'
 * @param {{ window?: number }} [opts]
 * @returns {Promise<{ chart_id, title, window, window_unit, explanation, model, context }>}
 */
export const explainChart = (chartId, { window, refresh } = {}) => {
  const body = { chartId }
  if (window) body.window = window
  if (refresh) body.refresh = true
  return api.post('/api/ai/insights/explain-chart', body).then((res) => res.data)
}

/** GET /api/ai/insights/charts — which charts can be explained. */
export const listExplainableCharts = () =>
  api.get('/api/ai/insights/charts').then((res) => res.data)
