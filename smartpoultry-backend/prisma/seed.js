// Load env vars first — required before any Prisma imports
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const bcrypt = require("bcrypt");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Starting seed...");

  // ─── Clean existing data (order matters for FK constraints) ───────────────
  await prisma.deliveryOrder.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.report.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.logEntry.deleteMany();
  await prisma.batch.deleteMany();
  await prisma.farm.deleteMany();
  await prisma.user.deleteMany();

  // ─── Create Admin User Only ────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || "admin123", 10);

  const admin = await prisma.user.create({
    data: {
      name: "Admin",
      email: "admin@smartpoultry.com",
      password: adminPassword,
      role: "ADMIN",
    },
  });

  console.log("✅ Admin user created");

  // ─── Seed Delivery Orders ──────────────────────────────────────────────────
  const deliveryOrders = [
    { orderId: "DEL-2026-001", customer: "Kofi Supermart",      product: "Eggs (Crates)",     quantity: 40,  status: "DELIVERED",  driver: "Kwame A.",     deliveryDate: new Date("2026-03-12"), amount: 2400,  notes: null },
    { orderId: "DEL-2026-002", customer: "Accra Fresh Market",  product: "Broilers (Live)",   quantity: 120, status: "IN_TRANSIT", driver: "Emmanuel B.", deliveryDate: new Date("2026-03-12"), amount: 7200,  notes: null },
    { orderId: "DEL-2026-003", customer: "Good Shepherd Hotel", product: "Eggs (Crates)",     quantity: 25,  status: "PENDING",    driver: "Unassigned",  deliveryDate: new Date("2026-03-13"), amount: 1500,  notes: null },
    { orderId: "DEL-2026-004", customer: "Tema Cold Store",     product: "Broilers (Frozen)", quantity: 200, status: "PENDING",    driver: "Unassigned",  deliveryDate: new Date("2026-03-13"), amount: 12000, notes: null },
    { orderId: "DEL-2026-005", customer: "Osu Market Stall",    product: "Noilers (Live)",    quantity: 50,  status: "DELIVERED",  driver: "Kwame A.",     deliveryDate: new Date("2026-03-11"), amount: 3500,  notes: null },
    { orderId: "DEL-2026-006", customer: "Legon Cafeteria",     product: "Eggs (Crates)",     quantity: 15,  status: "CANCELLED",  driver: "N/A",         deliveryDate: new Date("2026-03-10"), amount: 900,   notes: null },
  ];

  for (const order of deliveryOrders) {
    await prisma.deliveryOrder.create({
      data: {
        ...order,
        statusHistory: [{ status: order.status === "IN_TRANSIT" ? "In Transit" : order.status === "PENDING" ? "Pending" : order.status === "DELIVERED" ? "Delivered" : "Cancelled", timestamp: new Date().toISOString() }],
      },
    });
  }

  console.log("✅ 6 delivery orders seeded");

  console.log("\n🎉 Seed completed successfully!");
  console.log("─────────────────────────────────────");
  console.log("  Admin → admin@smartpoultry.com");
  console.log(`  Password: ${process.env.ADMIN_PASSWORD || "admin123"}`);
  console.log("─────────────────────────────────────");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
