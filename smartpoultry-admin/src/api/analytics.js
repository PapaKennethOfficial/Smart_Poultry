import api from './axios'

/**
 * GET /api/analytics/trend/eggs?days=N
 * Daily egg totals — these are MEASUREMENTS, not predictions.
 * For a real forward-looking forecast use getEggForecast() in aiAnalytics.js.
 * @returns {Promise<Array<{ date: string, day: string, actual: number }>>}
 */
export const fetchEggTrend = (days = 10) =>
  api.get('/api/analytics/trend/eggs', { params: { days } }).then((res) => res.data)

/** @deprecated Renamed to fetchEggTrend — this never returned a forecast. */
export const fetchForecast = () => fetchEggTrend(10)

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
 * @returns {Promise<{ recentYield, fcrStatus, anomalyScore, healthStatus }>}
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

/**
 * GET /api/analytics/sales-tracker?days=30
 * Full transaction-side view: headline KPIs, revenue timeseries, status +
 * payment breakdowns, top products by revenue, recent transactions.
 * @param {number} days — window length in days (default 30, max 365)
 * @returns {Promise<{
 *   windowDays: number,
 *   headline: { totalRevenue, deliveredRevenue, pendingRevenue, cancelledRevenue,
 *               totalOrders, avgOrderValue, unpaidBalance, wowRevenueChange,
 *               priorRevenue },
 *   revenueTimeseries: Array<{ date, revenue, orders }>,
 *   statusBreakdown:   Array<{ status, count, amount }>,
 *   paymentBreakdown:  Array<{ status, count, amount }>,
 *   topProducts:       Array<{ productName, unit, count, revenue }>,
 *   recentTransactions: Array<{ orderId, customer, product, amount, status,
 *                               paymentStatus, paymentMethod, createdAt }>,
 * }>}
 */
export const fetchSalesTracker = (days = 30) =>
  api.get('/api/analytics/sales-tracker', { params: { days } }).then((r) => r.data)

/**
 * GET /api/analytics/supply-vs-demand?days=30
 * Eggs produced against eggs ordered, on one time axis.
 * @returns {Promise<{ series, totalProduced, totalOrdered, netSurplus,
 *                     coveragePct, daysShort, worstShortfall, windowDays }>}
 */
export const fetchSupplyVsDemand = (days = 30) =>
  api.get('/api/analytics/supply-vs-demand', { params: { days } }).then((r) => r.data)
