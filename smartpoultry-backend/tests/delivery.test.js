/**
 * Delivery timing, distance and fee helpers.
 *
 * `updatedAt` was used as the delivery time. It moves on ANY write — a payment
 * status change or a note edit weeks later — so an order delivered in two hours
 * but edited a month afterwards scored 720 hours, silently inflating every
 * driver's average.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const { haversineKm, calculateDeliveryFee } = require("../src/utils/distance");

/** Mirrors deliveredAtOf in analytics.controller.js. */
function deliveredAtOf(order) {
  const history = Array.isArray(order.statusHistory) ? order.statusHistory : [];
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (h && h.status === "DELIVERED" && h.timestamp) {
      const t = new Date(h.timestamp);
      if (!Number.isNaN(t.getTime())) return t;
    }
  }
  return new Date(order.updatedAt);
}

const hoursBetween = (a, b) => (b.getTime() - a.getTime()) / 3_600_000;

test("delivery time comes from statusHistory, not updatedAt", () => {
  const order = {
    createdAt: "2026-08-01T08:00:00Z",
    updatedAt: "2026-09-01T08:00:00Z", // edited a month later
    statusHistory: [
      { status: "PENDING", timestamp: "2026-08-01T08:00:00Z" },
      { status: "DELIVERED", timestamp: "2026-08-01T10:00:00Z" },
    ],
  };
  const hours = hoursBetween(new Date(order.createdAt), deliveredAtOf(order));
  assert.equal(hours, 2, "should be 2 hours, not the ~744 that updatedAt implies");
});

test("falls back to updatedAt for rows predating statusHistory", () => {
  const order = {
    createdAt: "2026-08-01T08:00:00Z",
    updatedAt: "2026-08-01T11:30:00Z",
    statusHistory: [],
  };
  assert.equal(hoursBetween(new Date(order.createdAt), deliveredAtOf(order)), 3.5);
});

test("a malformed timestamp does not poison the result", () => {
  const order = {
    createdAt: "2026-08-01T08:00:00Z",
    updatedAt: "2026-08-01T09:00:00Z",
    statusHistory: [{ status: "DELIVERED", timestamp: "not-a-date" }],
  };
  const hours = hoursBetween(new Date(order.createdAt), deliveredAtOf(order));
  assert.ok(Number.isFinite(hours), "must not produce NaN");
  assert.equal(hours, 1);
});

test("the last DELIVERED entry wins when an order is re-delivered", () => {
  const order = {
    createdAt: "2026-08-01T08:00:00Z",
    updatedAt: "2026-08-01T20:00:00Z",
    statusHistory: [
      { status: "DELIVERED", timestamp: "2026-08-01T10:00:00Z" },
      { status: "IN_TRANSIT", timestamp: "2026-08-01T11:00:00Z" },
      { status: "DELIVERED", timestamp: "2026-08-01T13:00:00Z" },
    ],
  };
  assert.equal(hoursBetween(new Date(order.createdAt), deliveredAtOf(order)), 5);
});

// ─── Distance ────────────────────────────────────────────────────────────────

test("haversine: identical points are zero apart", () => {
  assert.equal(haversineKm(5.6037, -0.187, 5.6037, -0.187), 0);
});

test("haversine: Accra to Kumasi is roughly 200 km", () => {
  // Accra 5.6037,-0.1870 -> Kumasi 6.6885,-1.6244. Real great-circle ~199 km.
  const d = haversineKm(5.6037, -0.187, 6.6885, -1.6244);
  assert.ok(d > 190 && d < 210, `expected ~199 km, got ${d}`);
});

test("haversine is symmetric", () => {
  const a = haversineKm(5.6, -0.2, 6.7, -1.6);
  const b = haversineKm(6.7, -1.6, 5.6, -0.2);
  assert.ok(Math.abs(a - b) < 1e-9);
});

test("haversine returns 0 rather than NaN on missing coordinates", () => {
  // Orders without a captured location must not poison a distance average.
  assert.equal(haversineKm(null, null, 5.6, -0.2), 0);
  assert.equal(haversineKm(5.6, -0.2, undefined, undefined), 0);
});

// ─── Delivery fee ────────────────────────────────────────────────────────────

test("delivery fee is base plus distance rate", () => {
  // At the depot itself the distance is zero, so only the base fee applies.
  assert.equal(calculateDeliveryFee(5.6037, -0.187), 10);
});

test("delivery fee grows with distance", () => {
  const near = calculateDeliveryFee(5.61, -0.19);
  const far = calculateDeliveryFee(6.6885, -1.6244);
  assert.ok(far > near, "a Kumasi delivery must cost more than a local one");
  assert.ok(far > 400, `expected ~10 + 199*2.5, got ${far}`);
});
