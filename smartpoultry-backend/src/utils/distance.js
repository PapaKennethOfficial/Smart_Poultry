function haversineKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Fixed farm coordinates (e.g., Accra, Ghana) for base calculation if needed
const FARM_LAT = 5.6037;
const FARM_LON = -0.1870;

function calculateDeliveryFee(deliveryLat, deliveryLon) {
  const baseFee = 10.0; // 10 GHS base fee
  const ratePerKm = 2.5; // 2.5 GHS per km
  const dist = haversineKm(FARM_LAT, FARM_LON, deliveryLat, deliveryLon);
  return Number((baseFee + (dist * ratePerKm)).toFixed(2));
}

module.exports = {
  haversineKm,
  calculateDeliveryFee
};
