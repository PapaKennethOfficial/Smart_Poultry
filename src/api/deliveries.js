import api from './axios'

/**
 * GET /api/deliveries?status=
 * Returns { deliveries: [...], counts: { all, pending, transit, delivered } }
 */
export const fetchDeliveries = (status) => {
  const params = status ? { status } : {}
  return api.get('/api/deliveries', { params }).then((res) => res.data)
}

/**
 * POST /api/deliveries
 * @param {object} data - { customer, product, quantity, driver, deliveryDate, address, amount, notes }
 * @returns {{ delivery: object }}
 */
export const createDelivery = (data) =>
  api.post('/api/deliveries', data).then((res) => res.data)

/**
 * PATCH /api/deliveries/:id/status
 * @param {string} id - Delivery cuid
 * @param {string} status - "Pending" | "In Transit" | "Delivered" | "Cancelled"
 */
export const updateDeliveryStatus = (id, status) =>
  api.patch(`/api/deliveries/${id}/status`, { status }).then((res) => res.data)

/**
 * GET /api/deliveries/revenue
 * @returns {{ todayTotal: number, pendingTotal: number, monthTotal: number }}
 */
export const fetchDeliveryRevenue = () =>
  api.get('/api/deliveries/revenue').then((res) => res.data)
