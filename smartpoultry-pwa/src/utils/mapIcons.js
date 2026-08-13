// Shared Google-Maps marker icon builders. Both the customer's live-tracking
// modal (CustomerOrders) and the driver's own map (AssignedDeliveries) call
// buildCarIcon(...) so the driver marker looks identical in both places.
//
// Icons are emitted as inline SVG data URIs — zero extra HTTP requests, and
// nothing to 404 if a bundled asset gets renamed.

// Kept as a single-line string so it survives the encodeURIComponent round-trip
// with no whitespace weirdness. The car body + wheels + windscreen are drawn on
// a white circular halo so it stays legible against green/water tiles.
const CAR_SVG = (
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">' +
    '<circle cx="24" cy="24" r="22" fill="#ffffff" stroke="#2563eb" stroke-width="2.5"/>' +
    '<path d="M12 27 L14 21 A3 3 0 0 1 17 19 L31 19 A3 3 0 0 1 34 21 L36 27 L36 33 A1.5 1.5 0 0 1 34.5 34.5 L33 34.5 A1.5 1.5 0 0 1 31.5 33 L31.5 32 L16.5 32 L16.5 33 A1.5 1.5 0 0 1 15 34.5 L13.5 34.5 A1.5 1.5 0 0 1 12 33 Z" fill="#2563eb"/>' +
    '<path d="M15.5 27 L17 22.5 L31 22.5 L32.5 27 Z" fill="#ffffff" opacity="0.95"/>' +
    '<circle cx="18" cy="31" r="2.2" fill="#111827"/>' +
    '<circle cx="30" cy="31" r="2.2" fill="#111827"/>' +
  '</svg>'
)

/**
 * Build a Google Maps Marker `icon` object rendering a car.
 * Call this INSIDE a component that has already loaded the Maps JS SDK
 * (i.e. window.google.maps is defined) — usually inside the `isLoaded`
 * branch of useJsApiLoader.
 */
export function buildCarIcon(size = 40) {
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(CAR_SVG),
    scaledSize: new window.google.maps.Size(size, size),
    anchor: new window.google.maps.Point(size / 2, size / 2),
  }
}

/**
 * Build a Google Maps Marker `icon` object rendering a filled circular pin.
 * Kept here so the destination pin styling is one line at the callsite
 * instead of the 6-line inline object literal that was there before.
 */
export function buildPinIcon(color = '#237227', scale = 10) {
  return {
    path: window.google.maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
    scale,
  }
}
