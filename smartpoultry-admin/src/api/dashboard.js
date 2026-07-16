import api from './axios'

/**
 * GET /api/dashboard/summary
 * @returns {Promise<{ totalEggs: number, mortalityRate: number, pendingDeliveries: number, feedUsed: number }>}
 */
export const getSummary = () =>
  api.get('/api/dashboard/summary').then((res) => res.data)

/**
 * GET /api/dashboard/egg-chart?days=N
 * @param {{ days?: number }} params
 * @returns {Promise<Array<{ date: string, day: string, eggs: number }>>}
 */
export const getEggChart = ({ days = 7 } = {}) =>
  api.get('/api/dashboard/egg-chart', { params: { days } }).then((res) => res.data)

/**
 * GET /api/dashboard/mortality-chart?weeks=N
 * @param {{ weeks?: number }} params
 * @returns {Promise<Array<{ week: string, count: number }>>}
 */
export const getMortalityChart = ({ weeks = 6 } = {}) =>
  api.get('/api/dashboard/mortality-chart', { params: { weeks } }).then((res) => res.data)
