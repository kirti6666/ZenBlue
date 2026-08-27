import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { BackInStockRequest, Product } from "@/models";
import { getCurrentUser } from "@/lib/middleware/requireAuth";

const schema = z.object({
  productId: z.string().min(1),
  variantKey: z.string().optional().default(""),
  email: z.string().email("Enter a valid email address"),
});

/**
 * "Notify me when this is back" capture, recorded per variant.
 *
 * The unique index on (product, variantKey, email) makes a repeat signup a
 * no-op rather than a duplicate alert, so a shopper who taps twice still gets
 * exactly one email when stock lands.
 */
export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    await connectDB();
    const product = await Product.findById(parsed.data.productId).select("_id backInStockEnabled");
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    if (product.backInStockEnabled === false) {
      return NextResponse.json({ error: "Alerts are turned off for this item" }, { status: 400 });
    }

    const user = await getCurrentUser(req);

    await BackInStockRequest.findOneAndUpdate(
      {
        product: parsed.data.productId,
        variantKey: parsed.data.variantKey,
        email: parsed.data.email.toLowerCase(),
      },
      {
        $set: { status: "waiting", notifiedAt: null, ...(user ? { user: user.id } : {}) },
        $setOnInsert: {
          product: parsed.data.productId,
          variantKey: parsed.data.variantKey,
          email: parsed.data.email.toLowerCase(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Back-in-stock signup error:", err);
    return NextResponse.json({ error: "Could not register your alert" }, { status: 500 });
  }
}
