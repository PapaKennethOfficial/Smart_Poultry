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

  const customerLat = toNumberOrNull(deliveryLatitude)
  const customerLon = toNumberOrNull(deliveryLongitude)

  // -- Geographic Grouping Logic --
  // If the new order has coordinates, check if any driver is headed nearby AND hasn't left the farm yet.
  if (hasCoordinates(customerLat, customerLon)) {
    const driverIds = drivers.map((d) => d.id)
    
    // Fetch all active deliveries for these drivers
    const activeDeliveries = await db.deliveryOrder.findMany({
      where: {
        driverId: { in: driverIds },
        status: { in: ACTIVE_DELIVERY_STATUSES },
      },
      select: {
        driverId: true,
        status: true,
        deliveryLatitude: true,
        deliveryLongitude: true,
      },
    })

    const driversInTransit = new Set()
    for (const order of activeDeliveries) {
      if (order.status === 'IN_TRANSIT') {
        driversInTransit.add(order.driverId)
      }
    }

    const candidates = []
    const MAX_GROUPING_RADIUS_KM = 5.0

    for (const order of activeDeliveries) {
      // If driver has already left the farm, they cannot take new orders for this run
      if (driversInTransit.has(order.driverId)) continue

      const orderLat = toNumberOrNull(order.deliveryLatitude)
      const orderLon = toNumberOrNull(order.deliveryLongitude)
      if (!hasCoordinates(orderLat, orderLon)) continue

      const dist = distanceKm(customerLat, customerLon, orderLat, orderLon)
      if (dist <= MAX_GROUPING_RADIUS_KM) {
        const driver = drivers.find((d) => d.id === order.driverId)
        if (driver) {
          candidates.push({ driver, distance: dist })
        }
      }
    }

    if (candidates.length > 0) {
      // Sort candidates primarily by distance, and tie-break by active deliveries count
      candidates.sort((a, b) => {
        if (a.distance !== b.distance) return a.distance - b.distance
        return a.driver._count.assignedDeliveries - b.driver._count.assignedDeliveries
      })
      
      return candidates[0].driver
    }
  }

  // -- Fallback: Round-Robin (Load Balancing) --
  // If no driver is headed nearby, or coordinates are missing, pick the driver with the fewest deliveries.
  drivers.sort((a, b) => a._count.assignedDeliveries - b._count.assignedDeliveries)
  
  const minDeliveries = drivers[0]._count.assignedDeliveries
  const leastLoadedDrivers = drivers.filter(d => d._count.assignedDeliveries === minDeliveries)

  // If only one driver has the minimum deliveries, return them immediately
  if (leastLoadedDrivers.length === 1) return leastLoadedDrivers[0]

  // If multiple drivers are tied, and we have coordinates, check their last known live location
  if (hasCoordinates(customerLat, customerLon)) {
    const tiedDriverIds = leastLoadedDrivers.map((driver) => driver.id)
    const locationRows = await db.deliveryOrder.findMany({
      where: {
        driverId: { in: tiedDriverIds },
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
        return left.driver.createdAt - right.driver.createdAt // Stable fallback
      })[0].driver
  }

  // Final fallback if no coordinates
  return leastLoadedDrivers[0]
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
