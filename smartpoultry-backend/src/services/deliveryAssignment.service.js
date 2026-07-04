const prisma = require("../config/prisma")

const ACTIVE_DELIVERY_STATUSES = ["PENDING", "IN_TRANSIT"]

function driverSelect() {
  return {
    id: true,
    name: true,
    email: true,
    phone: true,
    role: true,
    deliveryStaffStatus: true,
    createdAt: true,
    vehicle: {
      select: {
        id: true,
        make: true,
        model: true,
        license_plate: true,
        vehicle_type: true,
        vehicle_photo: true,
        driver_photo: true,
        driver_contact_number: true,
        driver_residential_address: true,
        is_active: true,
        verification_status: true,
      },
    },
  }
}

function eligibleDriverWhere(driverId) {
  const where = {
    role: "DELIVERY",
    deliveryStaffStatus: "ACTIVE",
    vehicle: {
      verification_status: "APPROVED",
      is_active: true,
    },
  }

  if (driverId) where.id = driverId
  return where
}

function hasCoordinates(latitude, longitude) {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function degreesToRadians(value) {
  return (value * Math.PI) / 180
}

function distanceKm(aLat, aLon, bLat, bLon) {
  const earthRadiusKm = 6371
  const latDistance = degreesToRadians(bLat - aLat)
  const lonDistance = degreesToRadians(bLon - aLon)
  const startLat = degreesToRadians(aLat)
  const endLat = degreesToRadians(bLat)

  const haversine =
    Math.sin(latDistance / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(lonDistance / 2) ** 2

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

async function findEligibleDriver(driverId, db = prisma) {
  if (!driverId) return null

  return db.user.findFirst({
    where: eligibleDriverWhere(driverId),
    select: driverSelect(),
  })
}

async function selectAvailableDriver(options = {}) {
  const {
    db = prisma,
    deliveryLatitude,
    deliveryLongitude,
    excludeDriverIds = [],
  } = options

  const where = eligibleDriverWhere()
  if (excludeDriverIds.length > 0) {
    where.id = { notIn: excludeDriverIds }
  }

  const drivers = await db.user.findMany({
    where,
    select: {
      ...driverSelect(),
      _count: {
        select: {
          assignedDeliveries: {
            where: { status: { in: ACTIVE_DELIVERY_STATUSES } }
          }
        }
      }
    },
    orderBy: { createdAt: "asc" },
  })

  if (drivers.length === 0) return null

  // Sort by fewest active deliveries first (Round-Robin / Load Balancing)
  drivers.sort((a, b) => a._count.assignedDeliveries - b._count.assignedDeliveries)
  
  // Get all drivers who share the minimum delivery count
  const minDeliveries = drivers[0]._count.assignedDeliveries
  const leastLoadedDrivers = drivers.filter(d => d._count.assignedDeliveries === minDeliveries)

  if (leastLoadedDrivers.length === 1) return leastLoadedDrivers[0]

  const customerLat = toNumberOrNull(deliveryLatitude)
  const customerLon = toNumberOrNull(deliveryLongitude)
  if (!hasCoordinates(customerLat, customerLon)) return leastLoadedDrivers[0]

  const driverIds = leastLoadedDrivers.map((driver) => driver.id)
  const locationRows = await db.deliveryOrder.findMany({
    where: {
      driverId: { in: driverIds },
      driverLatitude: { not: null },
      driverLongitude: { not: null },
    },
    select: {
      driverId: true,
      driverLatitude: true,
      driverLongitude: true,
      driverLocationUpdatedAt: true,
      updatedAt: true,
    },
    orderBy: [
      { driverLocationUpdatedAt: "desc" },
      { updatedAt: "desc" },
    ],
  })

  const latestLocationByDriver = new Map()
  for (const row of locationRows) {
    if (!row.driverId || latestLocationByDriver.has(row.driverId)) continue
    latestLocationByDriver.set(row.driverId, row)
  }

  return leastLoadedDrivers
    .map((driver) => {
      const location = latestLocationByDriver.get(driver.id)
      const lat = toNumberOrNull(location?.driverLatitude)
      const lon = toNumberOrNull(location?.driverLongitude)
      const distance = hasCoordinates(lat, lon)
        ? distanceKm(customerLat, customerLon, lat, lon)
        : null

      return { driver, distance }
    })
    .sort((left, right) => {
      if (left.distance !== null && right.distance !== null) return left.distance - right.distance
      if (left.distance !== null) return -1
      if (right.distance !== null) return 1
      return left.driver.createdAt - right.driver.createdAt
    })[0].driver
}

function createAssignmentHistory(driver, source = "AUTO") {
  if (!driver) return null

  return {
    status: "DRIVER_ASSIGNED",
    driverId: driver.id,
    driverName: driver.name,
    source,
    timestamp: new Date().toISOString(),
  }
}

module.exports = {
  ACTIVE_DELIVERY_STATUSES,
  createAssignmentHistory,
  eligibleDriverWhere,
  findEligibleDriver,
  selectAvailableDriver,
}
