/**
 * ZenBlue seed script.
 *
 * Populates a fresh database with everything needed to browse and transact:
 *  - 1 admin user
 *  - the three catalogue categories from the quotation (T-Shirts, Polos,
 *    Streetwear) plus Accessories
 *  - a real menswear catalogue with size/colour variants, HSN codes, fabric
 *    and care copy, and package weights
 *  - the CMS content pages and FAQ entries from lib/content-defaults.ts
 *  - Site Settings and Invoice Settings pre-filled for ZenBlue
 *  - two working coupons
 *
 * Run with: npm run seed
 * Requires MONGODB_URI in .env.local
 *
 * WARNING: this clears existing catalogue/content data before reseeding.
 * Safe for local/dev use only — never run it against a production database.
 */

import dotenv from "dotenv";
import fs from "fs";
import path from "path";

/**
 * Load the environment before anything else is imported.
 *
 * `.env.local.txt` is checked too: Notepad on Windows appends .txt unless the
 * user picks "All Files", and the resulting "MONGODB_URI is not set" is a
 * genuinely confusing way to discover that. Reading it anyway costs nothing and
 * saves a support round-trip.
 */
const ENV_CANDIDATES = [".env.local", ".env.local.txt", ".env"];
const envFile = ENV_CANDIDATES.map((name) => path.resolve(process.cwd(), name)).find((p) =>
  fs.existsSync(p)
);

if (envFile) {
  dotenv.config({ path: envFile });
  if (envFile.endsWith(".txt")) {
    console.warn(
      `\n  Note: read "${path.basename(envFile)}" — rename it to ".env.local" so Next.js picks it up too.\n`
    );
  }
} else {
  console.error(
    [
      "",
      "  No environment file found in:",
      `    ${process.cwd()}`,
      "",
      "  Create `.env.local` there (next to package.json) with at least:",
      "    MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/zenblue",
      "    JWT_ACCESS_SECRET=<random>",
      "    JWT_REFRESH_SECRET=<different random>",
      "",
      "  Run `npm run seed` from the project root, not from a subfolder.",
      "",
    ].join("\n")
  );
  process.exit(1);
}

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import {
  User,
  Category,
  Product,
  Coupon,
  ContentPage,
  Faq,
  SiteSettings,
  InvoiceSettings,
} from "../models";
import { DEFAULT_CONTENT_PAGES, DEFAULT_FAQS } from "../lib/content-defaults";
import { DEFAULT_SETTINGS } from "../lib/site-settings";

const MONGODB_URI = process.env.MONGODB_URI as string;

if (!MONGODB_URI) {
  console.error(
    [
      "",
      `  MONGODB_URI is missing from ${path.basename(envFile)}.`,
      "",
      "  It should look like:",
      "    MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/zenblue",
      "",
      "  No quotes around the value. If the password contains @ # / or ?, URL-encode",
      "  it (@ becomes %40).",
      "",
    ].join("\n")
  );
  process.exit(1);
}

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@zenblue.in";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Deterministic pseudo-random so reseeding produces a comparable catalogue. */
function seededInt(seed: string, min: number, max: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return min + (hash % (max - min + 1));
}

const CATEGORIES = [
  // Order matches the navbar. Shirts and Combo are seeded without products so
  // the nav links resolve to a real (empty) category page rather than a 404 —
  // they fill up as soon as the catalogue is loaded through the admin.
  { name: "Shirts", description: "Cut clean, finished properly, made to be worn often." },
  { name: "T-Shirts", description: "Heavyweight cotton tees cut to hold their shape." },
  { name: "Combo", description: "Two-piece sets and value packs, priced together." },
  { name: "Polos", description: "Pique and interlock polos with collars that stay put." },
  { name: "Streetwear", description: "Oversized fits, hoodies and everything louder." },
  { name: "Accessories", description: "The small things that finish the fit." },
];

/** Apparel under ₹1,000 is 5% GST in India; at or above, 12%. HSN 6109/6105/6110. */
function gstRateFor(price: number): number {
  return price < 1000 ? 5 : 12;
}

interface ProductSeed {
  title: string;
  category: string;
  price: number;
  discountPrice?: number;
  hsn: string;
  fabric: string;
  care: string;
  fit: string;
  sizeChartKey: string;
  colours: string[];
  description: string;
  featured?: boolean;
  weightKg: number;
  /** Days before today the product went live — drives the New Arrivals order. */
  publishedDaysAgo: number;
}

const SIZES = ["S", "M", "L", "XL", "XXL"];

const CARE_TEE =
  "Machine wash cold, inside out, with like colours. Do not bleach. Tumble dry low or line dry in shade. Warm iron on the reverse; do not iron over prints.";
const CARE_KNIT =
  "Machine wash cold on a gentle cycle. Do not bleach or wring. Dry flat in shade to hold the collar. Cool iron if needed.";

const PRODUCTS: ProductSeed[] = [
  // ---- T-Shirts ----
  {
    title: "Heavyweight Cotton Tee",
    category: "T-Shirts",
    price: 1299,
    hsn: "6109",
    fabric: "240 GSM combed cotton, bio-washed",
    care: CARE_TEE,
    fit: "Regular",
    sizeChartKey: "tshirt",
    colours: ["Deep Navy", "Off White", "Charcoal", "Olive"],
    featured: true,
    weightKg: 0.28,
    publishedDaysAgo: 4,
    description:
      "Our benchmark tee. 240 GSM combed cotton that holds its shape through the wash, a ribbed collar that does not curl, and side seams that keep the body clean. Cut regular through the chest with a slightly shorter sleeve so it sits right without bunching.",
  },
  {
    title: "Supima Crew Neck Tee",
    category: "T-Shirts",
    price: 1599,
    discountPrice: 1349,
    hsn: "6109",
    fabric: "180 GSM Supima cotton",
    care: CARE_TEE,
    fit: "Slim",
    sizeChartKey: "tshirt",
    colours: ["White", "Black", "Steel Blue"],
    featured: true,
    weightKg: 0.22,
    publishedDaysAgo: 11,
    description:
      "Long-staple Supima cotton, spun finer and combed twice, so the surface stays smooth instead of pilling at the shoulders. Lighter than our heavyweight and cut closer through the waist — the one to wear under a jacket.",
  },
  {
    title: "Garment-Dyed Pocket Tee",
    category: "T-Shirts",
    price: 999,
    hsn: "6109",
    fabric: "200 GSM cotton, garment dyed",
    care: CARE_TEE,
    fit: "Relaxed",
    sizeChartKey: "tshirt",
    colours: ["Faded Navy", "Sand", "Rust"],
    weightKg: 0.26,
    publishedDaysAgo: 28,
    description:
      "Dyed after stitching, so the colour settles unevenly the way a well-worn tee does — every piece lands slightly different. Chest pocket, relaxed body, and a hem that sits below the belt.",
  },
  {
    title: "Long Sleeve Rib Tee",
    category: "T-Shirts",
    price: 1449,
    hsn: "6109",
    fabric: "220 GSM ribbed cotton",
    care: CARE_TEE,
    fit: "Regular",
    sizeChartKey: "tshirt",
    colours: ["Black", "Deep Navy", "Bone"],
    weightKg: 0.32,
    publishedDaysAgo: 45,
    description:
      "A fine 2x1 rib that gives the fabric stretch without thinning it. Cuffs hold at the wrist rather than riding up. Works alone through spring and as a base layer once it turns.",
  },
  // ---- Polos ----
  {
    title: "Pique Knit Polo",
    category: "Polos",
    price: 1999,
    discountPrice: 1499,
    hsn: "6105",
    fabric: "220 GSM cotton pique",
    care: CARE_KNIT,
    fit: "Regular",
    sizeChartKey: "polo",
    colours: ["Deep Navy", "White", "Forest", "Slate"],
    featured: true,
    weightKg: 0.31,
    publishedDaysAgo: 7,
    description:
      "The classic textured pique, knitted at 220 GSM so the collar has enough body to stand on its own. Three-button placket in horn-finish, split hem, and a back panel cut a touch longer to stay tucked.",
  },
  {
    title: "Interlock Performance Polo",
    category: "Polos",
    price: 2199,
    hsn: "6105",
    fabric: "Cotton-modal interlock, moisture wicking",
    care: CARE_KNIT,
    fit: "Slim",
    sizeChartKey: "polo",
    colours: ["Charcoal", "Steel Blue", "Black"],
    weightKg: 0.29,
    publishedDaysAgo: 18,
    description:
      "A smoother interlock knit blended with modal — it moves sweat off the skin and resists creasing through a long day. Cut slimmer through the body with a self-fabric collar that will not flap.",
  },
  {
    title: "Tipped Collar Polo",
    category: "Polos",
    price: 2399,
    hsn: "6105",
    fabric: "230 GSM mercerised cotton",
    care: CARE_KNIT,
    fit: "Regular",
    sizeChartKey: "polo",
    colours: ["Deep Navy", "Bone"],
    weightKg: 0.33,
    publishedDaysAgo: 60,
    description:
      "Mercerised cotton for a low sheen, finished with a contrast tipping at the collar and cuffs. The detail that makes it read as considered rather than casual.",
  },
  // ---- Streetwear ----
  {
    title: "Oversized Boxy Tee",
    category: "Streetwear",
    price: 1699,
    hsn: "6109",
    fabric: "260 GSM heavy cotton",
    care: CARE_TEE,
    fit: "Oversized",
    sizeChartKey: "tshirt",
    colours: ["Washed Black", "Bone", "Deep Navy"],
    featured: true,
    weightKg: 0.34,
    publishedDaysAgo: 2,
    description:
      "Dropped shoulders, a wide body and a cropped length that sits at the hip. 260 GSM cotton with enough weight to hang properly instead of clinging. Size down if you want it merely relaxed.",
  },
  {
    title: "Heavy Fleece Hoodie",
    category: "Streetwear",
    price: 3499,
    discountPrice: 2999,
    hsn: "6110",
    fabric: "400 GSM brushed cotton fleece",
    care: CARE_KNIT,
    fit: "Oversized",
    sizeChartKey: "tshirt",
    colours: ["Charcoal", "Deep Navy", "Sand"],
    featured: true,
    weightKg: 0.68,
    publishedDaysAgo: 14,
    description:
      "400 GSM brushed-back fleece with a double-layer hood that actually holds shape, metal-tipped drawcords and a kangaroo pocket set low enough to use. Heavy enough to be the only layer most of the year.",
  },
  {
    title: "Relaxed Crew Sweatshirt",
    category: "Streetwear",
    price: 2799,
    hsn: "6110",
    fabric: "380 GSM loopback cotton",
    care: CARE_KNIT,
    fit: "Relaxed",
    sizeChartKey: "tshirt",
    colours: ["Bone", "Olive", "Washed Black"],
    weightKg: 0.6,
    publishedDaysAgo: 33,
    description:
      "Loopback cotton, left unbrushed inside so it breathes better than fleece. Ribbed side panels give it structure at the waist, and the crew neck is reinforced with a taped shoulder seam.",
  },
  {
    title: "Utility Cargo Joggers",
    category: "Streetwear",
    price: 2699,
    hsn: "6110",
    fabric: "Cotton twill with 2% elastane",
    care: CARE_KNIT,
    fit: "Tapered",
    sizeChartKey: "tshirt",
    colours: ["Olive", "Black", "Stone"],
    weightKg: 0.52,
    publishedDaysAgo: 21,
    description:
      "Twill with just enough elastane to move in. Two cargo pockets that close flat rather than gaping, elasticated cuffs, and a tapered leg that breaks cleanly over a sneaker.",
  },
  // ---- Accessories ----
  {
    title: "Ribbed Cotton Socks — Three Pack",
    category: "Accessories",
    price: 699,
    hsn: "6115",
    fabric: "Combed cotton with elastane rib",
    care: "Machine wash warm with like colours. Tumble dry low.",
    fit: "One size",
    sizeChartKey: "",
    colours: ["Mixed Neutrals"],
    weightKg: 0.15,
    publishedDaysAgo: 50,
    description:
      "Three pairs of mid-calf ribbed socks with a reinforced heel and toe, and a cuff that grips without leaving a mark.",
  },
  {
    title: "Woven Canvas Belt",
    category: "Accessories",
    price: 899,
    hsn: "6217",
    fabric: "Woven cotton canvas, brushed metal buckle",
    care: "Spot clean only. Do not machine wash.",
    fit: "One size",
    sizeChartKey: "",
    colours: ["Deep Navy", "Olive", "Black"],
    weightKg: 0.18,
    publishedDaysAgo: 70,
    description:
      "A stretch-woven canvas belt with a brushed metal buckle — no notches, so it adjusts anywhere along its length.",
  },
];

async function seed() {
  console.log("Connecting to MongoDB…");
  await mongoose.connect(MONGODB_URI);

  console.log("Clearing catalogue and content collections…");
  await Promise.all([
    Product.deleteMany({}),
    Category.deleteMany({}),
    Coupon.deleteMany({}),
    ContentPage.deleteMany({}),
    Faq.deleteMany({}),
    // Only the seeded admin is removed; real staff and customers are left alone.
    User.deleteMany({ email: ADMIN_EMAIL }),
  ]);

  // ---- Admin -----------------------------------------------------------
  console.log("Creating admin user…");
  const admin = await User.create({
    name: "ZenBlue Admin",
    email: ADMIN_EMAIL,
    password: await bcrypt.hash(ADMIN_PASSWORD, 12),
    provider: "credentials",
    role: "admin",
    isVerified: true,
    // Left off for local development so seeding does not lock you out before
    // an SMTP or SMS provider is configured. Turn it on before go-live.
    twoFactorEnabled: false,
  });

  // ---- Categories ------------------------------------------------------
  console.log("Creating categories…");
  const categories = await Category.insertMany(
    CATEGORIES.map((c) => ({ name: c.name, slug: slugify(c.name), isActive: true }))
  );
  const catByName = Object.fromEntries(categories.map((c) => [c.name, c]));

  // ---- Products --------------------------------------------------------
  console.log("Creating products…");
  const docs = PRODUCTS.map((seed) => {
    const slug = slugify(seed.title);
    const hasSizes = seed.sizeChartKey !== "";

    const variants = hasSizes
      ? [
          { name: "Size", options: SIZES },
          { name: "Colour", options: seed.colours },
        ]
      : [{ name: "Colour", options: seed.colours }];

    const variantCombinations: any[] = [];
    if (hasSizes) {
      for (const size of SIZES) {
        for (const colour of seed.colours) {
          variantCombinations.push({
            combination: new Map([
              ["Size", size],
              ["Colour", colour],
            ]),
            sku: `ZB-${slug.slice(0, 12).toUpperCase()}-${size}-${colour.slice(0, 3).toUpperCase()}`,
            // The middle sizes carry more depth, and a couple of lines land at
            // zero on purpose so low-stock badges and back-in-stock capture
            // are visible without editing anything.
            stock:
              size === "M" || size === "L"
                ? seededInt(`${slug}${size}${colour}`, 8, 30)
                : seededInt(`${slug}${size}${colour}`, 0, 12),
          });
        }
      }
    } else {
      for (const colour of seed.colours) {
        variantCombinations.push({
          combination: new Map([["Colour", colour]]),
          sku: `ZB-${slug.slice(0, 12).toUpperCase()}-${colour.slice(0, 3).toUpperCase()}`,
          stock: seededInt(`${slug}${colour}`, 5, 40),
        });
      }
    }

    const publishedAt = new Date(Date.now() - seed.publishedDaysAgo * 864e5);

    return {
      title: seed.title,
      slug,
      description: seed.description,
      images: [],
      category: catByName[seed.category]._id,
      price: seed.price,
      discountPrice: seed.discountPrice,
      sku: `ZB-${slug.slice(0, 14).toUpperCase()}`,
      stock: 0, // unused — every product here carries variants
      variants,
      variantCombinations,
      tags: [seed.category.toLowerCase(), seed.fit.toLowerCase(), "menswear"],

      hsnCode: seed.hsn,
      gstRate: gstRateFor(seed.discountPrice ?? seed.price),
      fabric: seed.fabric,
      careInstructions: seed.care,
      fitType: seed.fit,
      sizeChartKey: seed.sizeChartKey,
      weightKg: seed.weightKg,
      packageLengthCm: 30,
      packageBreadthCm: 24,
      packageHeightCm: 4,
      lowStockThreshold: 5,
      backInStockEnabled: true,

      metaTitle: `${seed.title} · ZenBlue`,
      metaDescription: seed.description.slice(0, 155),

      publishedAt,
      salesCount: seededInt(slug, 0, 180),
      isFeatured: seed.featured ?? false,
      isActive: true,
    };
  });

  await Product.insertMany(docs);

  // ---- Content pages & FAQs -------------------------------------------
  console.log("Creating content pages and FAQs…");
  await ContentPage.insertMany(
    DEFAULT_CONTENT_PAGES.map((p) => ({ ...p, isPublished: true, updatedBy: admin._id }))
  );
  await Faq.insertMany(DEFAULT_FAQS.map((f) => ({ ...f, isPublished: true })));

  // ---- Settings --------------------------------------------------------
  // Upserted rather than replaced, so re-running the seed never wipes real
  // configuration (payment keys, GSTIN) that has already been entered.
  console.log("Applying ZenBlue site settings…");
  await SiteSettings.findOneAndUpdate(
    { singletonKey: "site" },
    { $setOnInsert: { singletonKey: "site", ...DEFAULT_SETTINGS } },
    { upsert: true }
  );

  await InvoiceSettings.findOneAndUpdate(
    { singletonKey: "invoice" },
    {
      $setOnInsert: {
        singletonKey: "invoice",
        seller: {
          legalName: "ZenBlue Clothing Co.",
          tradeName: "ZenBlue",
          country: "India",
        },
        tax: { gstEnabled: true, defaultGstRate: 12, defaultHsnCode: "6109", pricesIncludeTax: true },
      },
    },
    { upsert: true }
  );

  // ---- Coupons ---------------------------------------------------------
  console.log("Creating coupons…");
  const inNinetyDays = new Date(Date.now() + 90 * 864e5);
  await Coupon.insertMany([
    {
      code: "WELCOME10",
      discountType: "percent",
      value: 10,
      minOrderValue: 1499,
      expiresAt: inNinetyDays,
      usageLimit: 0,
      isActive: true,
    },
    {
      // Referenced by the abandoned-cart sequence as the optional incentive.
      code: "COMEBACK150",
      discountType: "flat",
      value: 150,
      minOrderValue: 1299,
      expiresAt: inNinetyDays,
      usageLimit: 0,
      isActive: true,
    },
  ]);

  const variantCount = docs.reduce((sum, d) => sum + d.variantCombinations.length, 0);

  console.log("");
  console.log("Seed complete.");
  console.log(`  ${categories.length} categories`);
  console.log(`  ${docs.length} products (${variantCount} variants)`);
  console.log(`  ${DEFAULT_CONTENT_PAGES.length} content pages, ${DEFAULT_FAQS.length} FAQs`);
  console.log(`  2 coupons: WELCOME10, COMEBACK150`);
  console.log("");
  console.log(`  Admin login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log("  Change this password immediately after your first login.");
  console.log("");
  console.log("  Product images are intentionally empty — upload real photography");
  console.log("  from Admin → Products. Cards fall back to a neutral placeholder.");
  console.log("");

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
