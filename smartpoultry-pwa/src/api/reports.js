import api from './axios'

/**
 * POST /api/reports
 * Generate a report and get the download URL
 * @param {{ type: string, dateRange: string, format: string }} params
 * @returns {Promise<{ fileUrl: string }>}
 */
export const generateReport = ({ type, dateRange, format }) =>
  api.post('/api/reports', { type, dateRange, format }).then((res) => res.data)

/**
 * GET /api/reports/history
 * Fetch list of previously generated reports
 * @returns {Promise<Array<{ id, title, type, format, fileUrl, createdAt, generatedBy }>>}
 */
export const fetchReportHistory = () =>
  api.get('/api/reports/history').then((res) => res.data)

/**
 * GET /api/logs/audit
 * Fetch recent audit log entries
 * @returns {Promise<Array<{ id, action, endpoint, entity, user, createdAt }>>}
 */
export const fetchAuditLogs = () =>
  api.get('/api/logs/audit').then((res) => res.data)
