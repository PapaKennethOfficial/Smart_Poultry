const DELIVERY_STATUSES = ["PENDING", "IN_TRANSIT", "DELIVERED", "CANCELLED"]

const STATUS_ALIASES = {
  PENDING: "PENDING",
  PENDING_DELIVERY: "PENDING",
  IN_TRANSIT: "IN_TRANSIT",
  TRANSIT: "IN_TRANSIT",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
  CANCELED: "CANCELLED",
}

function asArray(value) {
  if (Array.isArray(value)) return value
  if (typeof value === "string" && value.includes(",")) {
    return value.split(",").map((item) => item.trim()).filter(Boolean)
  }
  return value === undefined || value === null || value === "" ? [] : [value]
}

function normalizeStatus(value) {
  if (value === undefined || value === null) return null
  const key = String(value).trim().toUpperCase().replace(/[\s-]+/g, "_")
  return STATUS_ALIASES[key] || null
}

function normalizeBoolean(value) {
  if (value === undefined || value === null || value === "") return null
  if (typeof value === "boolean") return value
  const normalized = String(value).trim().toLowerCase()
  if (["true", "1", "yes", "assigned"].includes(normalized)) return true
  if (["false", "0", "no", "unassigned"].includes(normalized)) return false
  return null
}

function parseDate(value, endOfDay = false) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  if (endOfDay) date.setHours(23, 59, 59, 999)
  return date
}

function stringContains(value) {
  return {
    contains: String(value).trim(),
    mode: "insensitive",
  }
}

function applyDateRange(where, query) {
  const from = parseDate(query.dateFrom || query.from || query.startDate)
  const to = parseDate(query.dateTo || query.to || query.endDate, true)
  if (!from && !to) return

  where.deliveryDate = {}
  if (from) where.deliveryDate.gte = from
  if (to) where.deliveryDate.lte = to
}

function applyStatusFilter(where, query) {
  const statuses = asArray(query.status)
    .map(normalizeStatus)
    .filter((status) => DELIVERY_STATUSES.includes(status))

  if (statuses.length === 1) where.status = statuses[0]
  if (statuses.length > 1) where.status = { in: statuses }
}

function applyAssignmentFilter(where, query) {
  if (where.driverId !== undefined) return

  const assigned = normalizeBoolean(query.assigned)
  const unassigned = normalizeBoolean(query.unassigned)

  if (query.driverId) {
    where.driverId = String(query.driverId)
    return
  }

  if (unassigned === true || assigned === false) {
    where.driverId = null
    return
  }

  if (assigned === true || unassigned === false) {
    where.driverId = { not: null }
  }
}

function buildDeliveryOrderWhere(query = {}, baseWhere = {}) {
  const where = { ...baseWhere }

  applyStatusFilter(where, query)
  applyDateRange(where, query)
  applyAssignmentFilter(where, query)

  if (query.customerId && where.customerId === undefined) where.customerId = String(query.customerId)
  if (query.productId) where.productId = String(query.productId)
  if (query.paymentStatus) where.paymentStatus = String(query.paymentStatus).trim().toUpperCase()
  if (query.paymentMethod) where.paymentMethod = String(query.paymentMethod).trim().toUpperCase()
  if (query.orderId) where.orderId = stringContains(query.orderId)

  if (query.customer) {
    const customer = String(query.customer).trim()
    where.customer = {
      is: {
        OR: [
          { name: stringContains(customer) },
          { email: stringContains(customer) },
          { phone: stringContains(customer) },
        ],
      },
    }
  }

  if (query.driver) {
    const driver = String(query.driver).trim()
    where.driver = {
      is: {
        OR: [
          { name: stringContains(driver) },
          { email: stringContains(driver) },
          { phone: stringContains(driver) },
        ],
      },
    }
  }

  if (query.product) {
    where.product = {
      is: {
        name: stringContains(query.product),
      },
    }
  }

  return where
}

function buildCountWhere(where) {
  const countWhere = { ...where }
  delete countWhere.status
  return countWhere
}

module.exports = {
  DELIVERY_STATUSES,
  buildCountWhere,
  buildDeliveryOrderWhere,
  normalizeStatus,
}
