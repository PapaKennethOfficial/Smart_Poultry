import api from './axios'

/**
 * GET /api/alerts
 * Returns all unresolved alerts ordered by newest first.
 * @returns {Promise<Array<{ id: string, type: string, message: string, severity: string, createdAt: string }>>}
 */
export const listAlerts = () =>
  api.get('/api/alerts').then((res) => res.data)
