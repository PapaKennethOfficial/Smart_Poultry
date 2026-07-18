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
 * POST /api/ai/forecast/retrain — force a fresh model train.
 */
export const retrainDemandForecast = () =>
  api.post('/api/ai/forecast/retrain').then((res) => res.data)

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
export const getMorningBriefing = () =>
  api.post('/api/ai/insights/morning-briefing').then((res) => res.data)

/**
 * POST /api/ai/insights/ask
 * @param {string} question — free-text question from the manager
 * @returns {Promise<{ question: string, answer: string, model: string, generated_at: string }>}
 */
export const askInsight = (question) =>
  api.post('/api/ai/insights/ask', { question }).then((res) => res.data)
