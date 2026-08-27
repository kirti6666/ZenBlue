import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Category from "../models/Category";
import Product from "../models/Product";

dotenv.config({ path: ".env.local" });

const uri = process.env.MONGODB_URI ?? "";
if (!uri) throw new Error("MONGODB_URI is missing from .env.local");

type CatalogItem = {
  title: string;
  slug: string;
  sku: string;
  category: "T-Shirts" | "Polos" | "Streetwear";
  price: number;
  discountPrice: number;
  sizes: string[];
  colorCount: number;
  fabric: string;
  fitType: string;
  description: string;
  imagePrefix: string;
};

const items: CatalogItem[] = [
  {
    title: "ZB Black Oversized T-Shirt",
    slug: "zb-black-oversized-t-shirt",
    sku: "ZB-WA-001",
    category: "Streetwear",
    price: 999,
    discountPrice: 599,
    sizes: ["38", "40", "42"],
    colorCount: 1,
    fabric: "100% Cotton · 260 GSM heavy gauge",
    fitType: "Oversized",
    description: "Heavy-gauge 260 GSM cotton oversized T-shirt, available in sizes 38, 40 and 42.",
    imagePrefix: "zb-black-oversized-t-shirt",
  },
  {
    title: "ZB Cotton Emboss Front T-Shirt",
    slug: "zb-cotton-t-shirt-emboss-ft",
    sku: "ZB-WA-002",
    category: "T-Shirts",
    price: 899,
    discountPrice: 499,
    sizes: ["M", "L", "XL", "XXL"],
    colorCount: 4,
    fabric: "100% Cotton",
    fitType: "Regular",
    description: "Cotton T-shirt with an embossed front, available in sizes M to XXL and 4 colours.",
    imagePrefix: "zb-cotton-t-shirt-emboss-ft",
  },
  {
    title: "ZB Quarter-Zip Polo T-Shirt",
    slug: "zb-polo-zipper-t-shirt",
    sku: "ZB-WA-003",
    category: "Polos",
    price: 699,
    discountPrice: 449,
    sizes: ["M", "L", "XL"],
    colorCount: 5,
    fabric: "Poly Cotton",
    fitType: "Polo",
    description: "Quarter-zip polo T-shirt with a colour-block design, available in sizes M to XL and 5 colours.",
    imagePrefix: "zb-polo-zipper-t-shirt",
  },
  {
    title: "ZB Cotton Oversized T-Shirts",
    slug: "zb-cotton-oversized-t-shirts",
    sku: "ZB-WA-004",
    category: "Streetwear",
    price: 799,
    discountPrice: 549,
    sizes: ["L", "XL"],
    colorCount: 6,
    fabric: "100% Cotton",
    fitType: "Oversized",
    description: "Cotton oversized T-shirt, available in sizes L and XL and 6 colours.",
    imagePrefix: "zb-cotton-oversized-t-shirts",
  },
  {
    title: "ZB Plus-Size Cotton T-Shirt",
    slug: "zb-cotton-t-shirt-ft-2",
    sku: "ZB-WA-005",
    category: "T-Shirts",
    price: 549,
    discountPrice: 349,
    sizes: ["2XL", "3XL", "4XL", "5XL"],
    colorCount: 12,
    fabric: "100% Cotton",
    fitType: "Regular",
    description: "Cotton T-shirt in inclusive sizes 2XL to 5XL, available in 12 colours.",
    imagePrefix: "zb-cotton-t-shirt-ft-2",
  },
  {
    title: "ZB Cotton T-Shirt",
    slug: "zb-cotton-t-shirt-ft",
    sku: "ZB-WA-006",
    category: "T-Shirts",
    price: 499,
    discountPrice: 299,
    sizes: ["S", "M", "L", "XL"],
    colorCount: 12,
    fabric: "Cotton",
    fitType: "Regular",
    description: "Everyday cotton T-shirt, available in sizes S to XL and 12 colours.",
    imagePrefix: "zb-cotton-t-shirt-ft",
  },
  {
    title: "ZB Lycra Oversized T-Shirt",
    slug: "zb-oversized-t-shirt-lycra",
    sku: "ZB-WA-007",
    category: "Streetwear",
    price: 999,
    discountPrice: 599,
    sizes: ["44", "46", "48", "50"],
    colorCount: 8,
    fabric: "Lycra",
    fitType: "Oversized",
    description: "Stretch Lycra oversized T-shirt, available in sizes 44 to 50 and 8 colours.",
    imagePrefix: "zb-oversized-t-shirt-lycra",
  },
  {
    title: "ZB 3-Button Polo T-Shirt",
    slug: "zb-polo-t-shirt-3-button",
    sku: "ZB-WA-008",
    category: "Polos",
    price: 799,
    discountPrice: 549,
    sizes: ["XXL"],
    colorCount: 5,
    fabric: "Poly Cotton",
    fitType: "Polo",
    description: "Classic three-button poly-cotton polo, available in size XXL and 5 colours.",
    imagePrefix: "zb-polo-t-shirt-3-button",
  },
];

const assetDirectory = path.join(process.cwd(), "public", "products", "whatsapp");

function imagePaths(prefix: string): string[] {
  const exactImageName = new RegExp(`^${prefix}-\\d+\\.jpg$`);
  return fs
    .readdirSync(assetDirectory)
    .filter((name) => exactImageName.test(name))
    .sort()
    .map((name) => `/products/whatsapp/${name}`);
}

async function main() {
  await mongoose.connect(uri);

  const categoryIds = new Map<string, mongoose.Types.ObjectId>();
  for (const name of ["T-Shirts", "Polos", "Streetwear"] as const) {
    const slug = name.toLowerCase();
    const category = await Category.findOneAndUpdate(
      { slug },
      { $set: { name, isActive: true }, $setOnInsert: { slug, parentCategory: null } },
      { new: true, upsert: true }
    );
    categoryIds.set(name, category._id);
  }

  let inserted = 0;
  let updated = 0;

  for (const item of items) {
    const images = imagePaths(item.imagePrefix);
    if (images.length === 0) throw new Error(`No images found for ${item.title}`);

    const variants = [{ name: "Size", options: item.sizes }];
    const variantCombinations = item.sizes.map((size, index) => ({
      combination: { Size: size },
      sku: `${item.sku}-${size}`,
      stock: 10,
      image: images[index % images.length],
    }));

    const update = {
      title: item.title,
      slug: item.slug,
      sku: item.sku,
      description: item.description,
      category: categoryIds.get(item.category),
      price: item.price,
      discountPrice: item.discountPrice,
      images,
      media: images.map((url) => ({ type: "image", url, alt: item.title })),
      stock: 0,
      variants,
      variantCombinations,
      tags: [
        item.category.toLowerCase(),
        item.fitType.toLowerCase(),
        item.fabric.toLowerCase(),
        `${item.colorCount}-colours`,
        "whatsapp-catalogue",
      ],
      fabric: item.fabric,
      fitType: item.fitType,
      sizeChartKey: "tshirts",
      weightKg: 0.35,
      packageLengthCm: 30,
      packageBreadthCm: 24,
      packageHeightCm: 4,
      lowStockThreshold: 5,
      backInStockEnabled: true,
      metaTitle: `${item.title} | ZenBlue`,
      metaDescription: item.description,
      isActive: true,
      publishedAt: new Date(),
    };

    const existing = await Product.findOne({
      $or: [{ slug: item.slug }, { sku: item.sku }, { title: item.title }],
    }).select("_id");

    if (existing) {
      await Product.updateOne({ _id: existing._id }, { $set: update });
      updated += 1;
    } else {
      await Product.create({ ...update, ratingsAverage: 0, ratingsCount: 0, isFeatured: false });
      inserted += 1;
    }
  }

  const imported = await Product.find({ tags: "whatsapp-catalogue" })
    .select("title slug price discountPrice images variants variantCombinations")
    .sort({ title: 1 })
    .lean();

  console.log(`Imported ${items.length} catalogue items (${inserted} new, ${updated} updated).`);
  for (const product of imported) {
    const stock = product.variantCombinations.reduce(
      (sum: number, variant: { stock: number }) => sum + variant.stock,
      0
    );
    console.log(`- ${product.title}: ${product.images.length} images, ${stock} opening stock`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
