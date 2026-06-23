// ─────────────────────────────────────────────────────────────────────────────
// Olive Mode — Local Seed Data
// Place at: prisma/seed.ts
//
// Run with: npx prisma db seed
//
// Add this to your package.json:
//   "prisma": {
//     "seed": "ts-node prisma/seed.ts"
//   }
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const products = [
  // ── Dresses ──────────────────────────────────────────────────────────────
  {
    productName: "Cabana Mesh Mini Dress",
    category:    "Dress",
    price:       48.00,
    tag:         "Bestseller",
    material:    "polyester",
    description: "Stunning soft mesh knitted fabric mini dress with flattering cutaway shoulders and thin straps with gold hardware details for that added touch of high summer glamour! In a pink and red stripe and lined for modesty this dress fits like a dream and looks equally great worn with flats by the beach or with heels for night time summer al fresco drinks! Model is 5 \' 5\'\' and wears a size Small. Fabric: 96% polyester 4% elastane",
    imageUrl:    "/images/Cabana Mesh Mini Dress.jpg",
    inStock:     true,
  },
  {
    productName: "St. Barts Multicolored Satchel",
    category:    "bag",
    price:       50.00,
    tag:         "New Arrival",
    material:    "polyester",
    description: "Introduce a burst of color into your day with this vibrant multicolored satchel featuring exquisite gold detailing, top handles and straps to match. A versatile everything bag, it seamlessly accompanies you from daily trips to sunny days at the beach. The harmonious blend of lively hues and elegant gold accents makes it not just a bag but a style statement, ensuring you functionality wherever you go. Satchel Gold Hardware Top Handle Adjustable Straps Weight: 1 lb (453.59 g ) Material: Polyester",
    imageUrl:    "/images/KITSCH-amber-shores-hair-perfume.jpg",
    inStock:     true,
  },
  {
    productName: "KITSCH - Amber Shores Hair Perfume",
    category:    "perfume",
    price:       20.00,
    tag:         "Premium",
    material:    "",
    description: "A woody aquatic scent that takes you to a golden Malibu sunset, warm breeze and all. A breezy mix of sea salt, amber, and driftwood notes for a fresh yet sun-kissed finish. No covering up smells—First-of-its-kind, patented odor-eliminating technology neutralizes odors right at the source Why You'll Love This: A quick way to refresh your hair between washes Use it on your hair, body—even your Kitsch Satin Pillowcase! Crafted by a world-renowned fragrance house Find a solo scent or layer for a customized fragrance Sheer, versatile, and easy to use Gym, work, weekend trips—this travel-friendly size goes wherever you do Vegan and cruelty-free Free from any direct synthetic CMRs (Carcinogens, Mutagens, Reproductive Toxins), phthalates, parabens, and PFAS Bottles made with 30% PCR (Post-consumer recycled content)",
    imageUrl:    "/images/St-Barts-Multicolored-Satchel.jpg",
    inStock:     true,
  },
];

async function main() {
  console.log("🌱 Seeding Olive Mode local database...\n");

  // Clear existing products first so seed is idempotent
  await prisma.product.deleteMany();
  console.log("  🗑️  Cleared existing products");

  // Insert all products
  for (const product of products) {
    const created = await prisma.product.create({ data: product });
    console.log(`  ✅ ${created.productName} — $${created.price}`);
  }

  console.log(`\n✅ Seeded ${products.length} products successfully.`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());