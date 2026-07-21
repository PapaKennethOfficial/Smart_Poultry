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
 * GET /api/analytics/fulfilment-funnel?days=30
 * @returns {Promise<Array<{ stage: string, count: number }>>}
 */
export const fetchFulfilmentFunnel = (days = 30) =>
  api.get('/api/analytics/fulfilment-funnel', { params: { days } }).then((r) => r.data)

/**
 * GET /api/analytics/driver-efficiency?days=30
 * @returns {Promise<Array<{ driverName: string, deliveries: number, avgHoursPerDelivery: number }>>}
 */
export const fetchDriverEfficiency = (days = 30) =>
  api.get('/api/analytics/driver-efficiency', { params: { days } }).then((r) => r.data)

/**
 * GET /api/analytics/order-heatmap?days=60
 * @returns {Promise<{ grid: number[][], rows: Array<{ day, hour, count }>, maxCount: number }>}
 */
export const fetchOrderHeatmap = (days = 60) =>
  api.get('/api/analytics/order-heatmap', { params: { days } }).then((r) => r.data)

