import { cache } from "react";
import { connectDB } from "@/lib/db";
import { Product } from "@/models";

/** Shared by metadata and page rendering so a product route performs one read. */
async function readProductBySlug(slug: string) {
  await connectDB();
  return Product.findOne({ slug, isActive: true })
    .populate("category", "name slug")
    .lean<any>();
}

export const getProductBySlug = cache(readProductBySlug);
