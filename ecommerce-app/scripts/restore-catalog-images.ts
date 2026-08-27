import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Category from "../models/Category";
import Product from "../models/Product";

dotenv.config({ path: ".env.local" });

const uri = process.env.MONGODB_URI ?? "";
if (!uri) throw new Error("MONGODB_URI is missing from .env.local");

const assetDirectory = path.join(process.cwd(), "public", "products", "whatsapp");

const catalogueProducts: Record<string, string> = {
  "woven-canvas-belt": "zb-black-oversized-t-shirt",
  "ribbed-cotton-socks-three-pack": "zb-cotton-t-shirt-emboss-ft",
  "utility-cargo-joggers": "zb-oversized-t-shirt-lycra",
  "relaxed-crew-sweatshirt": "zb-cotton-oversized-t-shirts",
  "heavy-fleece-hoodie": "zb-black-oversized-t-shirt",
  "oversized-boxy-tee": "zb-cotton-oversized-t-shirts",
  "tipped-collar-polo": "zb-polo-t-shirt-3-button",
  "interlock-performance-polo": "zb-polo-zipper-t-shirt",
  "pique-knit-polo": "zb-polo-t-shirt-3-button",
  "long-sleeve-rib-tee": "zb-cotton-t-shirt-ft-2",
  "garment-dyed-pocket-tee": "zb-cotton-t-shirt-ft",
  "supima-crew-neck-tee": "zb-cotton-t-shirt-emboss-ft",
  "heavyweight-cotton-tee": "zb-cotton-t-shirt-ft",
};

const categoryImages: Record<string, string> = {
  accessories: "/products/whatsapp/zb-black-oversized-t-shirt-09.jpg",
  combo: "/banners/shirts-that-define-you.png",
  polos: "/products/whatsapp/zb-polo-t-shirt-3-button-01.jpg",
  shirts: "/banners/timeless-elegance-black-shirt.png",
  streetwear: "/products/whatsapp/zb-black-oversized-t-shirt-01.jpg",
  "t-shirts": "/products/whatsapp/zb-cotton-t-shirt-ft-01.jpg",
};

function imagePaths(prefix: string): string[] {
  const pattern = new RegExp(`^${prefix}-\\d+\\.jpg$`);
  return fs
    .readdirSync(assetDirectory)
    .filter((name) => pattern.test(name))
    .sort()
    .map((name) => `/products/whatsapp/${name}`);
}

async function main() {
  await mongoose.connect(uri);

  let restoredProducts = 0;
  for (const [slug, prefix] of Object.entries(catalogueProducts)) {
    const images = imagePaths(prefix);
    if (images.length === 0) throw new Error(`No catalogue images found for ${slug}`);

    const product = await Product.findOne({ slug });
    if (!product) {
      console.warn(`Skipped missing product: ${slug}`);
      continue;
    }

    product.images = images;
    product.media = images.map((url) => ({ type: "image", url, alt: product.title }));
    product.variantCombinations.forEach((variant: { image?: string }, index: number) => {
      variant.image = images[index % images.length];
    });
    await product.save();
    restoredProducts += 1;
    console.log(`Restored ${images.length} images: ${product.title}`);
  }

  const categoryResult = await Category.bulkWrite(
    Object.entries(categoryImages).map(([slug, image]) => ({
      updateOne: { filter: { slug }, update: { $set: { image } } },
    }))
  );

  console.log(`Restored ${restoredProducts} catalogue products.`);
  console.log(`Matched ${categoryResult.matchedCount} categories; updated ${categoryResult.modifiedCount}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
