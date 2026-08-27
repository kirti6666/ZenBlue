import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Order } from "@/models";
import { getSiteSettings } from "@/lib/site-settings";

// Reads cookies/query params per request — never statically rendered.
export const dynamic = "force-dynamic";

/**
 * Public order lookup for the Track Order page.
 *
 * Authorisation is order number + the email or phone used at checkout. An order
 * number alone is not sufficient — they are short and guessable, and the
 * response contains the customer's name and delivery city.
 *
 * The response is deliberately a narrow projection: enough to render the
 * tracker, never the full address, line items or payment references.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderNumber = (searchParams.get("orderNumber") ?? "").trim().toUpperCase();
    const contact = (searchParams.get("contact") ?? "").trim().toLowerCase();

    if (!orderNumber || !contact) {
      return NextResponse.json({ error: "Order number and contact are both required" }, { status: 400 });
    }

    await connectDB();

    const order = await Order.findOne({ orderNumber })
      .populate("user", "email phone")
      .lean();

    // Same message whether the order is missing or the contact does not match,
    // so this endpoint cannot be used to confirm that an order number exists.
    const notFound = NextResponse.json(
      { error: "We could not find an order matching those details" },
      { status: 404 }
    );
    if (!order) return notFound;

    const o = order as any;
    const digits = (s: string) => s.replace(/\D/g, "");
    const candidates = [
      o.guestEmail,
      o.guestPhone,
      o.user?.email,
      o.user?.phone,
      o.shippingAddress?.phone,
    ]
      .filter(Boolean)
      .map((v: string) => String(v).toLowerCase());

    const matches = candidates.some(
      (c) => c === contact || (digits(c).length >= 10 && digits(c) === digits(contact))
    );
    if (!matches) return notFound;

    const settings = await getSiteSettings();

    return NextResponse.json({
      order: {
        orderNumber: o.orderNumber,
        orderStatus: o.orderStatus,
        placedAt: o.createdAt,
        awb: o.awb || undefined,
        courierName: o.courierName || undefined,
        trackingUrl: o.trackingUrl || undefined,
        itemCount: (o.items ?? []).reduce((s: number, i: any) => s + i.quantity, 0),
        total: o.total,
        currencySymbol: settings.commerce.currencySymbol,
        statusHistory: (o.statusHistory ?? []).map((h: any) => ({
          status: h.status,
          note: h.note,
          at: h.at,
        })),
      },
    });
  } catch (err) {
    console.error("Order tracking error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
