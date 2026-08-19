/**
 * Fulfilment funnel logic.
 *
 * The original implementation counted every CANCELLED order into the
 * "Confirmed" stage. An order cancelled while still PENDING never reached
 * confirmation, so the funnel could report more confirmed orders than were
 * actually confirmed — and could widen as it went down, which is impossible
 * for a funnel by definition.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

/** Mirrors getFulfilmentFunnel in analytics.controller.js. */
function funnel(orders) {
  const reached = { placed: 0, confirmed: 0, dispatched: 0, delivered: 0 };
  for (const o of orders) {
    reached.placed += 1;
    const history = Array.isArray(o.statusHistory) ? o.statusHistory : [];
    const seen = new Set(history.map((h) => h && h.status).filter(Boolean));
    seen.add(o.status);
    const everDispatched = seen.has("IN_TRANSIT") || seen.has("DELIVERED");
    if (everDispatched || seen.has("DRIVER_ASSIGNED")) reached.confirmed += 1;
    if (everDispatched) reached.dispatched += 1;
    if (seen.has("DELIVERED")) reached.delivered += 1;
  }
  return [
    { stage: "Placed", count: reached.placed },
    { stage: "Confirmed", count: reached.confirmed },
    { stage: "Dispatched", count: reached.dispatched },
    { stage: "Delivered", count: reached.delivered },
  ];
}

const h = (...statuses) => statuses.map((status) => ({ status, timestamp: "2026-08-01T00:00:00Z" }));

test("each stage is never larger than the one above it", () => {
  const orders = [
    { status: "DELIVERED", statusHistory: h("PENDING", "DRIVER_ASSIGNED", "IN_TRANSIT", "DELIVERED") },
    { status: "CANCELLED", statusHistory: h("PENDING") },
    { status: "CANCELLED", statusHistory: h("PENDING", "DRIVER_ASSIGNED", "IN_TRANSIT") },
    { status: "PENDING", statusHistory: h("PENDING") },
  ];
  const stages = funnel(orders);
  for (let i = 1; i < stages.length; i++) {
    assert.ok(
      stages[i].count <= stages[i - 1].count,
      `${stages[i].stage} (${stages[i].count}) exceeded ${stages[i - 1].stage} (${stages[i - 1].count})`
    );
  }
});

test("an order cancelled while pending was never confirmed", () => {
  const stages = funnel([{ status: "CANCELLED", statusHistory: h("PENDING") }]);
  assert.equal(stages[0].count, 1, "it was still placed");
  assert.equal(stages[1].count, 0, "but never confirmed — this was the bug");
  assert.equal(stages[2].count, 0);
  assert.equal(stages[3].count, 0);
});

test("an order cancelled after dispatch still counts as dispatched", () => {
  const stages = funnel([
    { status: "CANCELLED", statusHistory: h("PENDING", "DRIVER_ASSIGNED", "IN_TRANSIT") },
  ]);
  assert.equal(stages[1].count, 1, "confirmed");
  assert.equal(stages[2].count, 1, "dispatched");
  assert.equal(stages[3].count, 0, "never delivered");
});

test("rows predating statusHistory still count via their current status", () => {
  const stages = funnel([{ status: "DELIVERED", statusHistory: null }]);
  assert.equal(stages[3].count, 1, "a legacy row must not vanish from the funnel");
});

test("an empty period produces zeros, not a crash", () => {
  const stages = funnel([]);
  assert.deepEqual(stages.map((s) => s.count), [0, 0, 0, 0]);
});
