// ─────────────────────────────────────────────────────────────────────────────
// Olive Mode — Seed Data (Extracted from artisanalfutures.org)
// Place at: prisma/seed.ts
// Run with: npx tsx prisma/seed.ts
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function inferCategory(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("dress") || n.includes("gown") || n.includes("romper") || n.includes("jumpsuit") || n.includes("skirt") || n.includes("top") || n.includes("bustier") || n.includes("bodysuit") || n.includes("coat") || n.includes("jacket") || n.includes("shorts") || n.includes("pants") || n.includes("tee") || n.includes("sweater")) {
    if (n.includes("skirt"))  return "Skirt";
    if (n.includes("top") || n.includes("bustier") || n.includes("bodysuit") || n.includes("crop")) return "Top";
    if (n.includes("romper") || n.includes("jumpsuit")) return "Jumpsuit";
    if (n.includes("coat") || n.includes("jacket"))     return "Outerwear";
    if (n.includes("shorts") || n.includes("pants"))    return "Bottoms";
    if (n.includes("tee") || n.includes("sweater"))     return "Top";
    return "Dress";
  }
  if (n.includes("bag") || n.includes("tote") || n.includes("crossbody") || n.includes("clutch") || n.includes("satchel") || n.includes("backpack") || n.includes("messenger")) return "Bag";
  if (n.includes("earring") || n.includes("necklace") || n.includes("bracelet") || n.includes("ring") || n.includes("anklet") || n.includes("hoop") || n.includes("hoops")) return "Jewelry";
  if (n.includes("perfume") || n.includes("fragrance") || n.includes("roller")) return "Perfume";
  if (n.includes("wallet") || n.includes("card holder")) return "Wallet";
  if (n.includes("set") && (n.includes("fleur") || n.includes("reni") || n.includes("cabo"))) return "Set";
  return "Beauty";
}

const rawProducts = [
  { name: "Maui Satin Wrap Front Tie Waist Top",                price: 45.00,   imageUrl: "https://cdn.shopify.com/s/files/1/0524/0782/8630/products/image_737ac8ae-be4e-448a-9a93-6e37ac4effdd.jpg" },
  { name: "Banwa Gold Handle Tote",                             price: 50.00,   imageUrl: "https://cdn.shopify.com/s/files/1/0524/0782/8630/files/6BDB421D-11FB-4C0D-B5C4-F09EE2BFACDC.jpg" },
  { name: "Donna Mirror Metallic Card Holder Wallet: Gold",     price: 20.00,   imageUrl: "https://cdn.shopify.com/s/files/1/0524/0782/8630/files/cca411be8d16af9fbd3ef8f071badf9cb8ac056971ffbf2602a064b89a2eff1e.jpg" },
  { name: "Giselle Mirror Metallic Crossbody: Gold",            price: 70.00,   imageUrl: "https://cdn.shopify.com/s/files/1/0524/0782/8630/files/6ccf649d1f119b84cf75479480336dcacd4f1b49d5fa4dd4d9e81fe4acb41b90.jpg" },
  { name: "Sangria Camel Midi Dress",                           price: 48.00,   imageUrl: "https://cdn.shopify.com/s/files/1/0524/0782/8630/files/image_e2d1f268-104e-4c77-8d0f-50fc4d4debd6.jpg" },
  { name: "Raindrop Earrings Silver",                           price: 38.00,   imageUrl: "https://cdn.shopify.com/s/files/1/0524/0782/8630/files/DEC53EB6-2040-4773-AC76-7B155217E4F3.jpg" },
  { name: "Raindrop Earrings Gold",                             price: 38.00,   imageUrl: null },
  { name: "DR. JART+ K Beauty Dermask Intra Jet Firming Solution", price: 7.00, imageUrl: null },
  { name: "Tenoverten - The Rewind Exfoliator",                 price: 28.00,   imageUrl: null },
  { name: "St. Lucia Top Handle Tote",                          price: 45.00,   imageUrl: "https://cdn.shopify.com/s/files/1/0524/0782/8630/files/891DAAA3-A1D1-4440-AD8C-D8CA8834FDF6.jpg" },
  { name: "Bubble Evening Bag: Silver",                         price: 66.00,   imageUrl: null },
  { name: "Dr Jart Cryo Rubber Mask: Collagen",                 price: 15.00,   imageUrl: null },
  { name: "Riviera Orange Jumpsuit",                            price: 48.00,   imageUrl: "https://cdn.shopify.com/s/files/1/0524/0782/8630/products/image_7d6abd10-48be-44d0-bbf5-e24898d4f0a2.jpg" },
  { name: "Stainless Steel Gua Sha",                            price: 13.00,   imageUrl: null },
  { name: "The Fleur Set",                                      price: 148.00,  imageUrl: null },
  { name: "Saint Crossbody: Black",                             price: 32.00,   imageUrl: "https://cdn.shopify.com/s/files/1/0524/0782/8630/files/0241189B-183E-41AE-847A-57708B4F6510.jpg" },
  { name: "Donna Mirror Metallic Card Holder Wallet: Silver",   price: 20.00,   imageUrl: null },
  { name: "Giselle Mirror Metallic Crossbody: Silver",          price: 70.00,   imageUrl: null },
  { name: "Fiji Black Woven Crossbody",                         price: 40.00,   imageUrl: null },
  { name: "Cabana Mesh Mini Dress",                             price: 48.00,   imageUrl: "/images/Cabana Mesh Mini Dress.jpg",  tag: "Bestseller" },
  { name: "Fatima Bezel Tennis Bracelet: Gold",                 price: 45.00,   imageUrl: null },
  { name: "Ariel Ombre Mermaid Crochet Cover Up Dress",         price: 40.00,   imageUrl: null },
  { name: "Blue Lagoon Mesh Midaxi Dress",                      price: 48.00,   imageUrl: null },
  { name: "Fairytale Ballerina Clutch",                         price: 35.00,   imageUrl: null },
  { name: "KITSCH - Hair Wax Stick",                            price: 14.00,   imageUrl: null },
  { name: "Stone Ring: 7",                                      price: 35.00,   imageUrl: null },
  { name: "Leilani Black Leather Mini Skirt",                   price: 78.00,   imageUrl: "https://cdn.shopify.com/s/files/1/0524/0782/8630/files/86F482EE-DF29-4977-922D-0215804CB700.jpg" },
  { name: "Cher Black Feather Crop Top",                        price: 32.00,   imageUrl: "https://cdn.shopify.com/s/files/1/0524/0782/8630/files/8C92FA72-AD67-4FA5-A38B-1B152F73EE82.jpg" },
  { name: "Axel Nail Bracelet: Silver",                         price: 65.00,   imageUrl: null },
  { name: "Ribbed Bracelet",                                    price: 25.00,   imageUrl: null },
  { name: "COSRX Acne Clear Pimple Master Patch",               price: 7.00,    imageUrl: null },
  { name: "Tenoverten - The Rose Oil",                          price: 26.00,   imageUrl: null },
  { name: "Touchland - Glow Mist Rosewater",                    price: 16.00,   imageUrl: null },
  { name: "Touchland - Power Mist Pure Lavender",               price: 10.00,   imageUrl: null },
  { name: "Tahiti Straw Crossbody",                             price: 45.00,   imageUrl: null },
  { name: "Michelle Gold Link Small Woven Crossbody",           price: 40.00,   imageUrl: null },
  { name: "Anika Chain Link Ring: Gold",                        price: 36.00,   imageUrl: null },
  { name: "St. Barts Multicolored Satchel",                     price: 50.00,   imageUrl: "/images/St-Barts-Multicolored-Satchel.jpg", tag: "New Arrival" },
  { name: "Bora Bora Kelly Green Crossbody",                    price: 70.00,   imageUrl: null },
  { name: "Creamsicle Maxi Crochet Dress",                      price: 38.00,   imageUrl: null },
  { name: "Tracee Magenta Pink Metallic Long Sleeve Cutout Dress", price: 98.00, imageUrl: null },
  { name: "Star Cubic Necklace",                                price: 18.00,   imageUrl: null },
  { name: "KITSCH - Amber Shores Hair Perfume",                 price: 20.00,   imageUrl: "/images/KITSCH-amber-shores-hair-perfume.jpg", tag: "Premium" },
  { name: "Whitley Knit Crochet Fringe Midi Dress",             price: 98.00,   imageUrl: null },
  { name: "Cayman Backless Dress",                              price: 32.00,   imageUrl: null },
  { name: "Bora Bora Sky Blue Crossbody",                       price: 35.00,   imageUrl: null },
  { name: "Amalfi Red Floral Satin Midi Dress",                 price: 88.00,   imageUrl: null },
  { name: "Capri Crochet Maxi Dress",                           price: 32.00,   imageUrl: null },
  { name: "The Overnight Messenger",                            price: 70.00,   imageUrl: null },
  { name: "KITSCH - Metal Enamel Cloud & Bow Bobby Pins 8pc Set", price: 10.00, imageUrl: null },
  { name: "Chunky Twisted Ring",                                price: 26.00,   imageUrl: null },
  { name: "Vielö - Organic Hand Balm 50ml",                     price: 22.00,   imageUrl: null },
  { name: "The Dimma Dress",                                    price: 148.00,  imageUrl: null },
  { name: "Greece Twist Top",                                   price: 48.00,   imageUrl: null },
  { name: "KITSCH - Pistachio Latte Hair Perfume",              price: 20.00,   imageUrl: null },
  { name: "Lock Earrings",                                      price: 22.00,   imageUrl: null },
  { name: "Jizel Vertical Scrunch Crossbody",                   price: 42.00,   imageUrl: null },
  { name: "Refillable Ultimate Travel 11pc Set - Black & Ivory", price: 12.00,  imageUrl: null },
  { name: "KITSCH - Sheer Violet Hair Perfume",                 price: 20.00,   imageUrl: null },
  { name: "Dionne Carmel Dress",                                price: 72.00,   imageUrl: null },
  { name: "Kelly Red Cutout Strappy Jumpsuit",                  price: 96.00,   imageUrl: null },
  { name: "Mozambique Pearl Seashell Clutch",                   price: 90.00,   imageUrl: null },
  { name: "Zanzibar Marble Handle Clutch",                      price: 35.00,   imageUrl: null },
  { name: "No-Show Reusable Nipple Covers: Nood 9",             price: 24.00,   imageUrl: null },
  { name: "Butterfly Crystal Bag: Fuchsia",                     price: 80.00,   imageUrl: null },
  { name: "Sun Hoops Mini",                                     price: 18.00,   imageUrl: null },
  { name: "Houston Belted Romper",                              price: 28.00,   imageUrl: null },
  { name: "Poolside Ribbed Dress Cream",                        price: 48.00,   imageUrl: null },
  { name: "The Reni 3-Piece Set",                               price: 308.00,  imageUrl: null, tag: "Premium" },
  { name: "Refillable Ultimate Travel 11pc Set - Blush",        price: 12.00,   imageUrl: null },
  { name: "KITSCH - Warm Sugar Hair Perfume",                   price: 20.00,   imageUrl: null },
  { name: "Coastal Woven Crossbody",                            price: 65.00,   imageUrl: null },
  { name: "Chunky Tube Hoops Medium",                           price: 26.00,   imageUrl: null },
  { name: "Braided Band Bracelet",                              price: 36.00,   imageUrl: null },
  { name: "Tenoverten - The Sleep Mask",                        price: 36.00,   imageUrl: null },
  { name: "Vivica Clear Evening Clutch",                        price: 70.00,   imageUrl: null },
  { name: "Michelle Gold Link Large Woven Crossbody",           price: 80.00,   imageUrl: null },
  { name: "Tenoverten - The Heroine",                           price: 19.00,   imageUrl: null },
  { name: "Tamera Pink Sequin Dress",                           price: 92.00,   imageUrl: null },
  { name: "No-Show Reusable Nipple Covers: Nood 5",             price: 24.00,   imageUrl: null },
  { name: "CALA 2-in-1 Rose Quartz Sonic Facial Massager",      price: 22.00,   imageUrl: null },
  { name: "Boob Savior Adhesive Remover",                       price: 13.99,   imageUrl: null },
  { name: "Martinique Cut-Out Midi Dress",                      price: 28.00,   imageUrl: null },
  { name: "Shape Tape Breast Tape XL: Nood 5",                  price: 34.00,   imageUrl: null },
  { name: "Saint Crossbody: Oatmilk",                           price: 45.00,   imageUrl: null },
  { name: "Lena Gold Cut-Out Midi Dress",                       price: 48.00,   imageUrl: null },
  { name: "Francesca Gold Crystal Maxi Dress",                  price: 92.00,   imageUrl: null },
  { name: "Ribbed Hoops",                                       price: 28.00,   imageUrl: null },
  { name: "Ayana Chain Ring",                                   price: 25.00,   imageUrl: null },
  { name: "Marigold Satin Corset Maxi Sundress",                price: 126.00,  imageUrl: null },
  { name: "Pearl Straw Wood Clutch",                            price: 45.00,   imageUrl: null },
  { name: "Touchland - Power Mist Berry Bliss",                 price: 10.00,   imageUrl: null },
  { name: "Aaliyah Shell Earring: Gold",                        price: 36.00,   imageUrl: null },
  { name: "The Angela Cargo Pants",                             price: 32.00,   imageUrl: null },
  { name: "Link Anklet",                                        price: 35.00,   imageUrl: null },
  { name: "Sade Barrel Sleeve Trench Coat - Tinted Grunge Wash", price: 208.00, imageUrl: null },
  { name: "Touchland - Power Mist Vanilla Blossom",             price: 10.00,   imageUrl: null },
  { name: "Double Bar Earring",                                 price: 52.00,   imageUrl: null },
  { name: "Amber Striped Clutch",                               price: 33.00,   imageUrl: null },
  { name: "Soraya Beaded Nail Bracelet",                        price: 33.00,   imageUrl: null },
  { name: "Zahara Statement Earring",                           price: 38.00,   imageUrl: null },
  { name: "Halle Black Cutwork Maxi",                           price: 78.00,   imageUrl: null },
  { name: "Malika Cut Out Dress",                               price: 148.00,  imageUrl: null },
  { name: "Black Mesh Cosmetic Bag Set",                        price: 12.98,   imageUrl: null },
  { name: "Naima Hoop Earring: Silver",                         price: 30.00,   imageUrl: null },
  { name: "Jada Green Mesh Cargo Dress",                        price: 68.00,   imageUrl: null },
  { name: "Monroe Mini Puff Dress",                             price: 48.00,   imageUrl: null },
  { name: "Malta Gold Pearl Straw Clutch",                      price: 45.00,   imageUrl: null },
  { name: "Nia Ring: Silver",                                   price: 30.00,   imageUrl: null },
  { name: "Mykonos Maxi Dress",                                 price: 41.00,   imageUrl: null },
  { name: "CALA 5 Piece Hydrogel Lip Mask Rose Collagen",       price: 10.00,   imageUrl: null },
  { name: "Stone Cold Blue Crossbody",                          price: 65.00,   imageUrl: null },
  { name: "The Lavender Weighted Satin Eye Mask",               price: 24.00,   imageUrl: null },
  { name: "Nia Bustier Top",                                    price: 76.00,   imageUrl: null },
  { name: "Poolside Ribbed Dress Orange",                       price: 48.00,   imageUrl: null },
  { name: "Anguilla Lace Dress",                                price: 32.00,   imageUrl: null },
  { name: "Aspen Ring Mini",                                    price: 35.00,   imageUrl: null },
  { name: "Luxe Shower Cap - Floral",                           price: 24.00,   imageUrl: null },
  { name: "Exfoliating Body Dry Brush",                         price: 14.00,   imageUrl: null },
  { name: "Tiffany Canvas Backpack",                            price: 45.00,   imageUrl: null },
  { name: "Wake Up Hydrogel Eye Mask Charcoal",                 price: 5.00,    imageUrl: null },
  { name: "OLIVE MODE Signature Logo Unisex Tee",               price: 32.00,   imageUrl: null },
  { name: "Moisturizing Heel Socks",                            price: 16.00,   imageUrl: null },
  { name: "Janae Straw Clutch",                                 price: 60.00,   imageUrl: null },
  { name: "Botanical Fragrance Roller",                         price: 14.00,   imageUrl: null },
  { name: "Touchland - Power Mist Lemon Lime Spritz",           price: 10.00,   imageUrl: null },
  { name: "Aspen Bracelet",                                     price: 40.00,   imageUrl: null },
  { name: "No-Show Reusable Nipple Covers: Nood 7",             price: 24.00,   imageUrl: null },
  { name: "Ice Roller - Terracotta",                            price: 18.00,   imageUrl: null },
  { name: "Touchland - Power Mist Beach Coco",                  price: 10.00,   imageUrl: null },
  { name: "Moana Straw Clutch",                                 price: 90.00,   imageUrl: null },
  { name: "Maui Ruched Side Slit Midi Skirt",                   price: 45.00,   imageUrl: null },
  { name: "Zuri Oval Link Bracelet: Gold",                      price: 45.00,   imageUrl: null },
  { name: "Yara Dome Ring: Gold",                               price: 22.00,   imageUrl: null },
  { name: "Eco-Friendly Creaseless Clips 4pc Set",              price: 10.00,   imageUrl: null },
  { name: "Evian Facial Spray 1.7 oz",                          price: 8.50,    imageUrl: null },
  { name: "DR. JART+ Dermask Water Jet Vital Hydra Solution",   price: 7.00,    imageUrl: null },
  { name: "Laneige Lip Sleeping Mask Treatment Balm",           price: 24.00,   imageUrl: null },
  { name: "Sightsee Blue Jogger Jumpsuit",                      price: 38.00,   imageUrl: null },
  { name: "Bettany Bodysuit",                                   price: 29.00,   imageUrl: null },
  { name: "Spotted Back Out Dress",                             price: 45.00,   imageUrl: null },
  { name: "Somalia Shirt Dress",                                price: 88.00,   imageUrl: null },
  { name: "Cocktail Hour Chain Dress",                          price: 38.00,   imageUrl: null },
  { name: "Emerald Satin Slit Dress",                           price: 138.00,  imageUrl: null },
  { name: "Cabo Crop Top Set",                                  price: 22.00,   imageUrl: null },
  { name: "Prague High-Waist Shorts",                           price: 52.00,   imageUrl: null },
  { name: "Countdown Sequin Dress",                             price: 120.00,  imageUrl: null },
  { name: "Invite Only Bodysuit Sweater",                       price: 38.00,   imageUrl: null },
  { name: "Amara Midi Dress",                                   price: 148.00,  imageUrl: null },
  { name: "Last Call Vegan Leather Skirt",                      price: 92.00,   imageUrl: null },
  { name: "Malibu Slit Off White Dress",                        price: 65.00,   imageUrl: null },
  { name: "Starry Chiffon Maxi Dress",                          price: 72.00,   imageUrl: null },
  { name: "St.Lucia Cowl Neck Backless Crop Top",               price: 34.00,   imageUrl: null },
  { name: "A Night Out Dress",                                  price: 32.00,   imageUrl: null },
  { name: "Equestrian Suede Jacket",                            price: 90.00,   imageUrl: null },
  { name: "Shapewear Short Black",                              price: 25.00,   imageUrl: null },
];

const products = rawProducts.map(p => ({
  productName: p.name,
  category:    inferCategory(p.name),
  price:       p.price,
  tag:         (p as any).tag ?? null,
  material:    null,
  description: null,
  imageUrl:    p.imageUrl ?? null,
  inStock:     true,
}));

async function main() {
  console.log("🌱 Seeding Olive Mode database with real products...\n");

  await prisma.chatResult.deleteMany();
  await prisma.savedProduct.deleteMany();
  await prisma.product.deleteMany();
  console.log("  🗑️  Cleared existing products\n");

  for (const product of products) {
    const created = await prisma.product.create({ data: product });
    console.log(`  ✅ ${created.productName} (${created.category}) — $${created.price}`);
  }

  console.log(`\n✅ Seeded ${products.length} products successfully.`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());