import api from './axios'

/**
 * GET /api/analytics/forecast
 * Fetch the 10-day egg yield forecast
 * @returns {Promise<Array<{ day: string, predicted: number, confidence: number }>>}
 */
export const fetchForecast = () =>
  api.get('/api/analytics/forecast').then((res) => res.data)

/**
 * GET /api/analytics/fcr?weeks=N
 * Fetch weekly Feed Conversion Ratio data
 * @param {number} weeks — number of weeks to include (default 6)
 * @returns {Promise<Array<{ week: string, ratio: number, benchmark: number }>>}
 */
export const fetchFCR = (weeks = 6) =>
  api.get('/api/analytics/fcr', { params: { weeks } }).then((res) => res.data)

/**
 * GET /api/analytics/insights
 * Fetch AI insight card data
 * @returns {Promise<{ predictedYield, fcrStatus, anomalyScore, healthStatus }>}
 */
export const fetchInsights = () =>
  api.get('/api/analytics/insights').then((res) => res.data)

/**
 * GET /api/analytics/environmental
 * Fetch the 10-day temperature and humidity trends
 * @returns {Promise<Array<{ time: string, temp: number, humidity: number }>>}
 */
export const fetchEnvironmental = () =>
  api.get('/api/analytics/environmental').then((res) => res.data)

