require("dotenv").config({ path: require("path").resolve(__dirname, ".env") });
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding products...");

  const products = [
    // ─── Eggs ──────────────────────────────────────────
    {
      name: "Fresh Large Eggs",
      description: "Premium large organic eggs straight from the farm. Ideal for baking and cooking.",
      price: 45.0,
      unit: "crate (30 eggs)",
      stock: 100,
      category: "Eggs",
      isActive: true,
    },
    {
      name: "Fresh Medium Eggs",
      description: "Standard medium organic eggs for everyday meals and household use.",
      price: 38.0,
      unit: "crate (30 eggs)",
      stock: 150,
      category: "Eggs",
      isActive: true,
    },
    {
      name: "Fresh Small Eggs",
      description: "Budget-friendly small eggs, perfect for snacks and light cooking.",
      price: 30.0,
      unit: "crate (30 eggs)",
      stock: 120,
      category: "Eggs",
      isActive: true,
    },

    // ─── Poultry Meat ──────────────────────────────────
    {
      name: "Dressed Chicken (Broiler)",
      description: "Freshly dressed broiler chicken, cleaned and ready to cook.",
      price: 65.0,
      unit: "bird (approx 1.5kg)",
      stock: 50,
      category: "Poultry Meat",
      isActive: true,
    },
    {
      name: "Chicken Parts (Mixed)",
      description: "Assorted chicken parts — thighs, wings, and drumsticks.",
      price: 55.0,
      unit: "kg",
      stock: 40,
      category: "Poultry Meat",
      isActive: true,
    },

    // ─── Live Birds ────────────────────────────────────
    {
      name: "Live Broiler Chicken",
      description: "Healthy, farm-raised live broiler chicken ready for purchase.",
      price: 55.0,
      unit: "bird",
      stock: 80,
      category: "Live Birds",
      isActive: true,
    },
    {
      name: "Spent Layers",
      description: "Spent laying hens, excellent for local soups and stews.",
      price: 40.0,
      unit: "bird",
      stock: 120,
      category: "Live Birds",
      isActive: true,
    },
    {
      name: "Point-of-Lay Pullets",
      description: "Young hens about to start laying eggs — ready to boost your flock.",
      price: 70.0,
      unit: "bird",
      stock: 60,
      category: "Live Birds",
      isActive: true,
    },
    {
      name: "Day-Old Chicks",
      description: "Healthy day-old chicks for rearing. Vaccinated and ready to grow.",
      price: 8.0,
      unit: "chick",
      stock: 500,
      category: "Live Birds",
      isActive: true,
    },

    // ─── By-products ───────────────────────────────────
    {
      name: "Organic Poultry Manure",
      description: "Rich organic fertilizer for your farm or garden. Packed in 50kg bags.",
      price: 25.0,
      unit: "bag (50kg)",
      stock: 200,
      category: "Farm Inputs",
      isActive: true,
    },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { name: p.name },
      update: { ...p },
      create: { ...p },
    });
  }

  console.log(`✅ ${products.length} products seeded successfully`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

