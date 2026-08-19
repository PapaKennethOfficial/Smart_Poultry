/**
 * Tests for the pure analytics helpers.
 *
 * Uses node:test — built into Node 20+, so this adds no dependency.
 * Run with:  npm test
 *
 * These cover the functions where a silent error is most expensive: the ones
 * that produce numbers a manager will act on. Every case below corresponds to a
 * bug that actually existed in this codebase.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

// The controller pulls in prisma at require-time, so the maths is re-declared
// here in the same form. Keeping these in sync is the trade for not needing a
// database to run the suite.
const AVG_EGG_MASS_KG = 0.06;
const FCR_BENCHMARK = 2.3;

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values) {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((acc, v) => acc + (v - m) ** 2, 0) / (values.length - 1));
}

function zScore(current, baseline) {
  if (baseline.length < 3) return null;
  const sd = stdDev(baseline);
  if (sd === 0) return null;
  return (current - mean(baseline)) / sd;
}

function feedConversionRatio(feedKg, eggCount) {
  const eggMassKg = eggCount * AVG_EGG_MASS_KG;
  if (eggMassKg <= 0) return null;
  return feedKg / eggMassKg;
}

// ─── Feed Conversion Ratio ───────────────────────────────────────────────────

test("FCR is a mass ratio, not feed divided by egg count", () => {
  // 1000 eggs weigh 60 kg. 120 kg of feed is therefore an FCR of 2.0.
  // The original bug divided 120 by 1000 and reported 0.12, then compared it
  // to a benchmark of 2.3 and declared the farm 19x better than world record.
  const fcr = feedConversionRatio(120, 1000);
  assert.equal(fcr, 2);
  assert.notEqual(fcr, 120 / 1000);
});

test("FCR returns null, not zero, when no eggs were recorded", () => {
  // Zero would plot as a real data point meaning "perfectly efficient",
  // which is the opposite of "we have no data".
  assert.equal(feedConversionRatio(50, 0), null);
  assert.equal(feedConversionRatio(0, 0), null);
});

test("FCR verdict direction: lower is better", () => {
  const good = feedConversionRatio(100, 1000);  // 1.67
  const bad = feedConversionRatio(200, 1000);   // 3.33
  assert.ok(good < FCR_BENCHMARK, "1.67 should beat the benchmark");
  assert.ok(bad > FCR_BENCHMARK, "3.33 should miss the benchmark");
});

// ─── Anomaly detection ───────────────────────────────────────────────────────

test("z-score flags a genuine mortality spike", () => {
  const baseline = [2, 3, 2, 4, 3, 2, 3, 2, 3, 3];
  const z = zScore(20, baseline);
  assert.ok(z !== null);
  assert.ok(z > 3, `expected a large positive z, got ${z}`);
});

test("z-score is null on a flat baseline rather than infinite", () => {
  // Every day identical means zero deviation; dividing by it would be Infinity.
  assert.equal(zScore(10, [5, 5, 5, 5, 5]), null);
});

test("z-score is null when the baseline is too short to mean anything", () => {
  assert.equal(zScore(10, [5, 6]), null);
});

test("a normal day is not flagged", () => {
  const baseline = [10, 11, 9, 10, 12, 10, 9];
  const z = zScore(10, baseline);
  assert.ok(Math.abs(z) < 2, `expected within 2 sigma, got ${z}`);
});

test("sample standard deviation uses n-1, not n", () => {
  // For [2,4,4,4,5,5,7,9] the population sd is 2 and the sample sd is ~2.138.
  // We estimate from a sample of days, so n-1 is correct.
  const sd = stdDev([2, 4, 4, 4, 5, 5, 7, 9]);
  assert.ok(Math.abs(sd - 2.138) < 0.01, `expected ~2.138, got ${sd}`);
});
