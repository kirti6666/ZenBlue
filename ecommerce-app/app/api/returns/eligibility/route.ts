import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Order, ReturnRequest } from "@/models";
import { getCurrentUser } from "@/lib/middleware/requireAuth";
import { getSiteSettings } from "@/lib/site-settings";
import { checkReturnEligibility } from "@/lib/returns";

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

    return NextResponse.json({
      ...result,
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
