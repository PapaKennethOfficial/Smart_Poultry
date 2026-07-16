// Great-circle distance between two lat/lon points using the haversine formula.
// Returns the distance in kilometres. Not a routing distance — it's the shortest
// straight-line ("as the crow flies") distance across the Earth's surface. That
// is enough context for a customer to gauge how close their driver is without
// pulling in an external routing API.

const R_KM = 6371;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

export function haversineKm(a, b) {
  if (!a || !b) return null;
  const { lat: lat1, lon: lon1 } = a;
  const { lat: lat2, lon: lon2 } = b;
  if (
    typeof lat1 !== 'number' || typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' || typeof lon2 !== 'number'
  ) {
    return null;
  }
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Human-friendly distance string.
 * Under 1 km → "620 m". Above → "1.4 km" / "12 km".
 */
export function formatDistance(km) {
  if (km == null || !Number.isFinite(km)) return null;
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}
