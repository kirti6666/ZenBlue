import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Order } from "@/models";
import { requireAdmin } from "@/lib/middleware/requireAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { getSiteSettings } from "@/lib/site-settings";
import { getShippingProvider } from "@/lib/shipping/provider";

export const dynamic = "force-dynamic";

/**
 * Courier rate comparison for an order, so staff can pick on price and speed
 * rather than always defaulting to one partner.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, PERMISSIONS.SHIPPING);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const orderId = new URL(req.url).searchParams.get("orderId");
    if (!orderId) return NextResponse.json({ error: "orderId is required" }, { status: 400 });

    await connectDB();
    const [order, settings] = await Promise.all([
      Order.findById(orderId).lean<any>(),
      getSiteSettings(),
    ]);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    if (!settings.shipping.pickupPincode) {
      return NextResponse.json(
        { error: "Set your pickup pincode in Settings → Shipping first", rates: [] },
        { status: 400 }
      );
    }

    const provider = getShippingProvider(settings);
    const rates = await provider.getRates({
      fromPincode: settings.shipping.pickupPincode,
      toPincode: order.shippingAddress.pincode,
      weightKg: settings.shipping.defaultWeightKg,
      cod: order.paymentMethod === "cod",
      declaredValue: order.total,
    });

    return NextResponse.json({ rates, provider: provider.name });
  } catch (err) {
    console.error("Rate lookup error:", err);
    return NextResponse.json({ error: "Could not fetch rates", rates: [] }, { status: 500 });
  }
}
