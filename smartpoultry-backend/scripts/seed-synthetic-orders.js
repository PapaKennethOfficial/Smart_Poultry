/**
 * Seed ~30 days of synthetic delivery orders so the analytics dashboards,
 * Prophet demand forecast, and Gemini "morning briefing" have real numbers
 * to talk about.
 *
 * Idempotent-ish: it does NOT wipe existing data — it just adds new rows.
 * Rerun to add more variety, but note orderId collisions are avoided by
 * timestamped counter.
 *
 * Run:  node scripts/seed-synthetic-orders.js
 */

// Reuse the same Prisma client the API uses (has driver adapter wired).
const prisma = require("../src/config/prisma");
const bcrypt = require("bcrypt");

// ─── Config ─────────────────────────────────────────────────────────────────

const DAYS = 30;                    // how far back to synthesise
const AVG_ORDERS_PER_DAY = 4;       // Poisson-ish average
const WEEKEND_BOOST = 1.6;          // Fri/Sat get more traffic
const TREND_PER_DAY = 0.03;         // 3% growth per day over the window
const CUSTOMER_EMAIL = "synthetic-customer@smartpoultry.com";
const DRIVER_EMAIL = "synthetic-driver@smartpoultry.com";

// Accra centre + rough delivery-zone jitter
const DEPOT = { lat: 5.6037, lon: -0.1870 };
const CITY_JITTER_DEG = 0.09;       // ~10 km radius of noise around depot

// Realistic payment distribution
const PAYMENT_METHODS = [
  { v: "MOBILE_MONEY", w: 0.65 },
  { v: "PAY_ON_DELIVERY", w: 0.35 },
];

// Payment status distribution
const PAYMENT_STATUSES = [
  { v: "PAID", w: 0.55 },
  { v: "PENDING", w: 0.30 },
  { v: "AWAITING_CONFIRMATION", w: 0.10 },
  { v: "FAILED", w: 0.05 },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randFloat(min, max) {
  return Math.random() * (max - min) + min;
}
function pickWeighted(items) {
  const total = items.reduce((s, i) => s + i.w, 0);
  let r = Math.random() * total;
  for (const it of items) {
    if ((r -= it.w) <= 0) return it.v;
  }
  return items[items.length - 1].v;
}
function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function ensureCustomer() {
  const existing = await prisma.user.findUnique({ where: { email: CUSTOMER_EMAIL } });
  if (existing) return existing;
  const password = await bcrypt.hash("password123", 10);
  return prisma.user.create({
    data: {
      name: "Synthetic Customer",
      email: CUSTOMER_EMAIL,
      password,
      role: "CUSTOMER",
      phone: "+233240000000",
    },
  });
}

async function ensureDriver() {
  const existing = await prisma.user.findUnique({ where: { email: DRIVER_EMAIL } });
  if (existing) return existing;
  const password = await bcrypt.hash("password123", 10);
  return prisma.user.create({
    data: {
      name: "Synthetic Driver",
      email: DRIVER_EMAIL,
      password,
      role: "DELIVERY",
      phone: "+233240000001",
      deliveryStaffStatus: "ACTIVE",
    },
  });
}

async function loadProducts() {
  const products = await prisma.product.findMany();
  if (products.length === 0) {
    throw new Error(
      "No products in DB. Create some first via POST /api/products or seed manually."
    );
  }
  return products;
}

function nextOrderIdCounter(startingSequence) {
  const year = new Date().getFullYear();
  let n = startingSequence;
  return () => {
    n += 1;
    return `DEL-${year}-SYN${String(n).padStart(4, "0")}`;
  };
}

/**
 * Given a date `d` (in the past), decide a realistic final status.
 * The further back the order, the more likely it is DELIVERED.
 * Very recent orders trend PENDING / IN_TRANSIT.
 */
function statusForDay(daysAgo) {
  if (daysAgo <= 1) {
    return pickWeighted([
      { v: "PENDING", w: 0.55 },
      { v: "IN_TRANSIT", w: 0.30 },
      { v: "DELIVERED", w: 0.10 },
      { v: "CANCELLED", w: 0.05 },
    ]);
  }
  if (daysAgo <= 3) {
    return pickWeighted([
      { v: "PENDING", w: 0.10 },
      { v: "IN_TRANSIT", w: 0.35 },
      { v: "DELIVERED", w: 0.45 },
      { v: "CANCELLED", w: 0.10 },
    ]);
  }
  return pickWeighted([
    { v: "DELIVERED", w: 0.82 },
    { v: "CANCELLED", w: 0.10 },
    { v: "IN_TRANSIT", w: 0.05 },
    { v: "PENDING", w: 0.03 },
  ]);
}

function ordersFor(dayIndex) {
  // dayIndex = 0 (oldest) .. DAYS-1 (today)
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() - (DAYS - 1 - dayIndex));
  const dow = day.getDay(); // 0=Sun .. 6=Sat
  const trend = 1 + TREND_PER_DAY * dayIndex;
  const weekend = dow === 5 || dow === 6 ? WEEKEND_BOOST : 1.0;
  const mean = AVG_ORDERS_PER_DAY * trend * weekend;
  // Poisson-ish sample (Knuth). Good enough for a demo seed.
  const L = Math.exp(-mean);
  let k = 0, p = 1;
  do { k += 1; p *= Math.random(); } while (p > L);
  return { day, count: k - 1, dayIndex };
}

// ─── Main ───────────────────────────────────────────────────────────────────

(async () => {
  console.log("Seeding synthetic delivery orders");
  console.log(`  window: last ${DAYS} days, avg ${AVG_ORDERS_PER_DAY} orders/day`);

  const [customer, driver, products, existingSyn] = await Promise.all([
    ensureCustomer(),
    ensureDriver(),
    loadProducts(),
    prisma.deliveryOrder.count({ where: { orderId: { startsWith: `DEL-${new Date().getFullYear()}-SYN` } } }),
  ]);
  console.log(`  customer: ${customer.email}`);
  console.log(`  driver:   ${driver.email}`);
  console.log(`  products: ${products.length}`);
  console.log(`  existing SYN rows: ${existingSyn}`);

  const nextOrderId = nextOrderIdCounter(existingSyn);

  let created = 0;
  let byStatus = { PENDING: 0, IN_TRANSIT: 0, DELIVERED: 0, CANCELLED: 0 };

  for (let i = 0; i < DAYS; i++) {
    const { day, count, dayIndex } = ordersFor(i);
    const daysAgo = DAYS - 1 - dayIndex;

    for (let j = 0; j < count; j++) {
      const product = pickOne(products);
      const quantity = randInt(1, 5);
      const amount = Number((product.price * quantity).toFixed(2));

      // Spread order creation times throughout the day, biased toward daytime
      const createdAt = new Date(day);
      createdAt.setHours(randInt(8, 20), randInt(0, 59), randInt(0, 59));
      // Deliver 4–36 hours later
      const deliveryDate = new Date(createdAt.getTime() + randInt(4, 36) * 60 * 60 * 1000);
      const updatedAt = new Date(createdAt.getTime() + randInt(60, 24 * 60) * 60 * 1000);

      const status = statusForDay(daysAgo);
      byStatus[status] = (byStatus[status] || 0) + 1;

      const paymentMethod = pickWeighted(PAYMENT_METHODS);
      // Pay-on-delivery orders default to PENDING/PAID; card/momo can be AWAITING/FAILED
      const paymentStatus = paymentMethod === "PAY_ON_DELIVERY"
        ? (status === "DELIVERED" ? "PAID" : "PENDING")
        : pickWeighted(PAYMENT_STATUSES);

      await prisma.deliveryOrder.create({
        data: {
          orderId: nextOrderId(),
          customerId: customer.id,
          productId: product.id,
          driverId: status === "DELIVERED" || status === "IN_TRANSIT" ? driver.id : null,
          quantity,
          amount,
          paymentMethod,
          paymentStatus,
          status,
          deliveryDate,
          address: "Synthetic address, Greater Accra",
          contactNumber: "+233240000000",
          notes: "Auto-generated for analytics demo",
          deliveryLatitude: DEPOT.lat + randFloat(-CITY_JITTER_DEG, CITY_JITTER_DEG),
          deliveryLongitude: DEPOT.lon + randFloat(-CITY_JITTER_DEG, CITY_JITTER_DEG),
          createdAt,
          updatedAt,
          statusHistory: [
            { status: "PENDING", timestamp: createdAt.toISOString() },
            ...(status !== "PENDING" ? [{ status, timestamp: updatedAt.toISOString() }] : []),
          ],
        },
      });
      created += 1;
    }
  }

  console.log(`Done — created ${created} orders`);
  console.log("  by status:", byStatus);

  await prisma.$disconnect();
})().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
