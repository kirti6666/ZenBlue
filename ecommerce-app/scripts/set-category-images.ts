import dotenv from "dotenv";
import mongoose from "mongoose";
import Category from "../models/Category";

dotenv.config({ path: ".env.local" });

const uri = process.env.MONGODB_URI ?? "";
if (!uri) throw new Error("MONGODB_URI is missing from .env.local");

const images: Record<string, string> = {
  accessories: "/products/whatsapp/zb-black-oversized-t-shirt-09.jpg",
  combo: "/banners/shirts-that-define-you.png",
  polos: "/products/whatsapp/zb-polo-t-shirt-3-button-01.jpg",
  shirts: "/banners/timeless-elegance-black-shirt.png",
  streetwear: "/products/whatsapp/zb-black-oversized-t-shirt-01.jpg",
  "t-shirts": "/products/whatsapp/zb-cotton-t-shirt-ft-01.jpg",
};

async function main() {
  await mongoose.connect(uri);
  const operations = Object.entries(images).map(([slug, image]) => ({
    updateOne: { filter: { slug }, update: { $set: { image } } },
  }));
  const result = await Category.bulkWrite(operations);
  console.log(`Category images updated: ${result.modifiedCount}`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
