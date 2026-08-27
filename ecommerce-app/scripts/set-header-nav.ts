import dotenv from "dotenv";
import mongoose from "mongoose";
import Category from "../models/Category";
import SiteSettings from "../models/SiteSettings";

dotenv.config({ path: ".env.local" });

const uri = process.env.MONGODB_URI ?? "";
if (!uri) throw new Error("MONGODB_URI is missing from .env.local");

const promoImages = [
  "/banners/details-that-define-shirt.png",
  "/banners/effortless-expression-oversized-tee.png",
  "/banners/feel-the-difference.png",
];

const navLinks = [
  {
    label: "SHIRTS",
    href: "/category/shirts",
    promoImages: [...promoImages],
    children: [
      { label: "All Shirts", href: "/category/shirts" },
      { label: "Plain Shirts", href: "/category/shirts" },
      { label: "Printed Shirts", href: "/category/shirts" },
      { label: "Checked Shirts", href: "/category/shirts" },
      { label: "Striped Shirts", href: "/category/shirts" },
      { label: "Double Pocket Shirts", href: "/category/shirts" },
      { label: "Oversized Shirts", href: "/category/shirts" },
    ],
  },
  {
    label: "T SHIRTS",
    href: "/category/t-shirts",
    promoImages: [...promoImages],
    children: [
      { label: "All T-Shirts", href: "/category/t-shirts" },
      { label: "Cotton T-Shirts", href: "/category/t-shirts" },
      { label: "Oversized T-Shirts", href: "/category/streetwear" },
      { label: "Polo T-Shirts", href: "/category/polos" },
      { label: "Zipper Polos", href: "/category/polos" },
      { label: "Plus Size", href: "/category/t-shirts" },
    ],
  },
  {
    label: "COMBO",
    href: "/category/combo",
    promoImages: [...promoImages],
    children: [
      { label: "All Combos", href: "/category/combo" },
      { label: "T-Shirt Combos", href: "/category/combo" },
      { label: "Shirt Combos", href: "/category/combo" },
      { label: "Corporate Packs", href: "/bulk-orders" },
    ],
  },
  {
    label: "SHOP ALL",
    href: "/shop",
    promoImages: [...promoImages],
    children: [
      { label: "All Products", href: "/shop" },
      { label: "New Arrivals", href: "/new-arrivals" },
      { label: "Best Sellers", href: "/shop?sort=popular" },
      { label: "Sale", href: "/shop?sort=price-asc" },
    ],
  },
  {
    label: "BULK ORDERS",
    href: "/bulk-orders",
    promoImages: [...promoImages],
    children: [
      { label: "Corporate Orders", href: "/bulk-orders" },
      { label: "Team Uniforms", href: "/bulk-orders" },
      { label: "Event Orders", href: "/bulk-orders" },
      { label: "Request a Quote", href: "/bulk-orders" },
    ],
  },
  {
    label: "CUSTOMIZATION",
    href: "/customization",
    promoImages: [...promoImages],
    children: [
      { label: "Custom T-Shirts", href: "/customization" },
      { label: "Custom Shirts", href: "/customization" },
      { label: "Embroidery", href: "/customization" },
      { label: "Bulk Customization", href: "/customization" },
    ],
  },
];

async function main() {
  await mongoose.connect(uri);

  // Keep the category destinations valid even before products are assigned.
  for (const category of [
    { name: "Shirts", slug: "shirts" },
    { name: "Combo", slug: "combo" },
  ]) {
    await Category.updateOne(
      { slug: category.slug },
      {
        $set: { name: category.name, isActive: true },
        $setOnInsert: { slug: category.slug, parentCategory: null },
      },
      { upsert: true }
    );
  }

  const result = await SiteSettings.updateOne(
    { singletonKey: "site" },
    { $set: { "header.navLinks": navLinks } }
  );

  if (result.matchedCount !== 1) {
    throw new Error("The site settings document was not found");
  }

  console.log(`Configured ${navLinks.length} header navigation links.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
