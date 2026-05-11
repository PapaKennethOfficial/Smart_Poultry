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
  // Removed dummy delivery orders for production readiness.
  // The system will start with 0 deliveries, allowing you to create them manually.

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
