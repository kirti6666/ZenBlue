import dotenv from "dotenv";
import mongoose from "mongoose";
import SiteSettings from "../models/SiteSettings";

dotenv.config({ path: ".env.local" });

const uri = process.env.MONGODB_URI ?? "";
if (!uri) throw new Error("MONGODB_URI is missing from .env.local");

const heroSlides = [
  { image: "/banners/timeless-essential-polo.png", videoUrl: "", heading: "", subheading: "", link: "/category/polos" },
  { image: "/banners/effortless-expression-oversized-tee.png", videoUrl: "", heading: "", subheading: "", link: "/category/streetwear" },
  { image: "/banners/details-that-define-shirt.png", videoUrl: "", heading: "", subheading: "", link: "/shop" },
  { image: "/banners/effortless-style-plaid-shirt.png", videoUrl: "", heading: "", subheading: "", link: "/shop" },
  { image: "/banners/timeless-elegance-black-shirt.png", videoUrl: "", heading: "", subheading: "", link: "/shop" },
  { image: "/banners/shirts-that-define-you.png", videoUrl: "", heading: "", subheading: "", link: "/shop" },
  { image: "/banners/feel-the-difference.png", videoUrl: "", heading: "", subheading: "", link: "/shop" },
];

async function main() {
  await mongoose.connect(uri);
  const result = await SiteSettings.updateOne(
    { singletonKey: "site" },
    { $set: { "home.heroSlides": heroSlides } }
  );
  await mongoose.disconnect();

  if (result.matchedCount !== 1) {
    throw new Error("The site settings document was not found");
  }

  console.log(`Configured ${heroSlides.length} hero banners.`);
}

main().catch(async (error) => {
  await mongoose.disconnect().catch(() => undefined);
  console.error(error);
  process.exitCode = 1;
});
