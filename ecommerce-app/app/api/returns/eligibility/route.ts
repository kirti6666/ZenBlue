import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Order, Product, ReturnRequest } from "@/models";
import { getCurrentUser } from "@/lib/middleware/requireAuth";
import { getSiteSettings } from "@/lib/site-settings";
import { checkReturnEligibility } from "@/lib/returns";
import { variantKey } from "@/lib/inventory";

function asVariant(value: unknown): Record<string, string> {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value);
  return { ...(value as Record<string, string>) };
}

// Reads cookies/query params per request — never statically rendered.
export const dynamic = "force-dynamic";

/**
 * Tells the account UI whether an order can be returned and which lines/
 * quantities are still available, so the request form can be built without the
 * client re-implementing the window and part-return rules.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ error: "Please log in" }, { status: 401 });

    const orderId = new URL(req.url).searchParams.get("orderId");
    if (!orderId) return NextResponse.json({ error: "orderId is required" }, { status: 400 });

    await connectDB();
    const [order, settings] = await Promise.all([
      Order.findOne({ _id: orderId, user: user.id }).lean(),
      getSiteSettings(),
    ]);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const existing = await ReturnRequest.find({ order: orderId }).lean();
    const result = checkReturnEligibility(order, settings, existing);
    const products = await Product.find({
      _id: { $in: result.returnableItems.map((item) => item.product) },
      isActive: true,
    })
      .select("variantCombinations")
      .lean<any[]>();
    const byId = new Map(products.map((product) => [String(product._id), product]));
    const returnableItems = result.returnableItems.map((item) => {
      const product = byId.get(item.product);
      const exchangeOptions = (product?.variantCombinations ?? [])
        .filter((entry: any) => Number(entry.stock) > 0)
        .map((entry: any) => {
          const variant = asVariant(entry.combination);
          return {
            variant,
            variantKey: variantKey(variant),
            stock: Number(entry.stock),
            image: entry.image || item.image,
          };
        })
        .filter((entry: any) => entry.variantKey && entry.variantKey !== item.variantKey);
      return { ...item, exchangeOptions };
    });

    return NextResponse.json({
      ...result,
      returnableItems,
      policySummary: settings.returns.policySummary,
      exchangeEnabled: settings.returns.exchangeEnabled,
      storeCreditEnabled: settings.returns.storeCreditEnabled,
      windowDays: settings.returns.windowDays,
    });
  } catch (err) {
    console.error("Return eligibility error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
