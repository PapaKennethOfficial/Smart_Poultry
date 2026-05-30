require("dotenv").config({ path: require("path").resolve(__dirname, ".env") });
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding products...");

  const products = [
    {
      name: "Fresh Large Eggs",
      description: "Premium large organic eggs straight from the farm.",
      price: 45.0,
      unit: "crate (30 eggs)",
      stock: 100,
    },
    {
      name: "Fresh Medium Eggs",
      description: "Standard medium organic eggs for everyday meals.",
      price: 38.0,
      unit: "crate (30 eggs)",
      stock: 150,
    },
    {
      name: "Dressed Chicken (Broiler)",
      description: "Freshly dressed broiler chicken, ready to cook.",
      price: 65.0,
      unit: "bird (approx 1.5kg)",
      stock: 50,
    },
    {
      name: "Live Chicken (Broiler)",
      description: "Healthy live broiler chicken.",
      price: 55.0,
      unit: "bird",
      stock: 80,
    },
    {
      name: "Live Chicken (Layer)",
      description: "Spent layers, great for soups and stews.",
      price: 40.0,
      unit: "bird",
      stock: 120,
    },
    {
      name: "Organic Poultry Manure",
      description: "Rich organic fertilizer for your farm or garden.",
      price: 25.0,
      unit: "bag (50kg)",
      stock: 200,
    }
  ];

  for (const p of products) {
    await prisma.product.create({ data: p });
  }

  console.log("✅ Products seeded successfully");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
