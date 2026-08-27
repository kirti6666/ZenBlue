import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Product } from "@/models";

// Reads cookies/query params per request — never statically rendered.
export const dynamic = "force-dynamic";

/**
 * Type-ahead search for the header search bar.
 *
 * Deliberately separate from GET /api/products: that endpoint is a full listing
 * with pagination and filters, while this one is tuned for latency — a tiny
 * projection, a hard cap on results, and a regex prefix match so partial words
 * ("pol") match, which MongoDB's $text index will not do.
 *
 * $text is still used first because it ranks whole-word matches better; the
 * regex is the fallback when $text finds nothing.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();
    const limit = Math.min(10, Number(searchParams.get("limit") ?? 6));

    if (q.length < 2) return NextResponse.json({ products: [] });

    await connectDB();

    const projection = "title slug price discountPrice images";

    let docs = await Product.find(
      { isActive: true, $text: { $search: q } },
      { score: { $meta: "textScore" } }
    )
      .select(projection)
      .sort({ score: { $meta: "textScore" } })
      .limit(limit)
      .lean();

    if (docs.length === 0) {
      // Escape the term — a shopper typing "(" must not build a broken regex.
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      docs = await Product.find({ isActive: true, title: { $regex: safe, $options: "i" } })
        .select(projection)
        .limit(limit)
        .lean();
    }

    const products = (docs as any[]).map((p) => ({
      _id: String(p._id),
      title: p.title,
      slug: p.slug,
      image: p.images?.[0] ?? "",
      price: p.discountPrice && p.discountPrice < p.price ? p.discountPrice : p.price,
    }));

    return NextResponse.json({ products });
  } catch (err) {
    console.error("Product search error:", err);
    return NextResponse.json({ products: [] });
  }
}
