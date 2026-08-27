import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Order, Shipment } from "@/models";
import { requireAdmin } from "@/lib/middleware/requireAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { logAdminAction, getClientIp } from "@/lib/middleware/logAdminAction";
import { getSiteSettings } from "@/lib/site-settings";
import { getShippingProvider } from "@/lib/shipping/provider";
import { notify } from "@/lib/notifications/dispatch";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

/**
 * Refreshes a shipment from the courier and syncs the result onto the order.
 *
 * Courier statuses are mapped onto our own order statuses so the customer sees
 * one consistent vocabulary regardless of which aggregator is in use.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(req, PERMISSIONS.SHIPPING);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    await connectDB();
    const shipment = await Shipment.findById(params.id);
    if (!shipment) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!shipment.awb) return NextResponse.json({ shipment: shipment.toObject() });

    const settings = await getSiteSettings();
    const provider = getShippingProvider(settings);
    const tracking = await provider.track(shipment.awb);

    if (tracking.ok) {
      if (tracking.events?.length) shipment.trackingEvents = tracking.events;
      if (tracking.deliveredAt) shipment.deliveredAt = tracking.deliveredAt;
      if (tracking.expectedDeliveryAt) shipment.expectedDeliveryAt = tracking.expectedDeliveryAt;

      const mapped = mapCourierStatus(tracking.status ?? "");
      if (mapped) shipment.status = mapped as any;
      await shipment.save();

      await syncOrderFromShipment(shipment, settings);
    }

    return NextResponse.json({
      shipment: shipment.toObject(),
      trackingError: tracking.ok ? undefined : tracking.error,
    });
  } catch (err) {
    console.error("Track shipment error:", err);
    return NextResponse.json({ error: "Could not refresh tracking" }, { status: 500 });
  }
}

const patchSchema = z.object({
  status: z.string().optional(),
  awb: z.string().max(120).optional(),
  courierName: z.string().max(120).optional(),
  trackingUrl: z.string().max(500).optional(),
  labelUrl: z.string().max(500).optional(),
  pickupScheduledFor: z.string().optional(),
});

/** Manual edit — used when staff book outside the API or fix a typo. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(req, PERMISSIONS.SHIPPING);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    await connectDB();
    const shipment = await Shipment.findById(params.id);
    if (!shipment) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const before = { status: shipment.status, awb: shipment.awb };
    const d = parsed.data;

    if (d.status) shipment.status = d.status as any;
    if (d.awb !== undefined) shipment.awb = d.awb;
    if (d.courierName !== undefined) shipment.courierName = d.courierName;
    if (d.trackingUrl !== undefined) shipment.trackingUrl = d.trackingUrl;
    if (d.labelUrl !== undefined) shipment.labelUrl = d.labelUrl;
    if (d.pickupScheduledFor) shipment.pickupScheduledFor = new Date(d.pickupScheduledFor);

    await shipment.save();

    const settings = await getSiteSettings();
    await syncOrderFromShipment(shipment, settings);

    await logAdminAction({
      adminId: admin.id,
      action: "SHIPMENT_UPDATE",
      targetType: "Shipment",
      targetId: String(shipment._id),
      changes: { before, after: { status: shipment.status, awb: shipment.awb } },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ shipment: shipment.toObject() });
  } catch (err) {
    console.error("Update shipment error:", err);
    return NextResponse.json({ error: "Could not update the shipment" }, { status: 500 });
  }
}

/** Courier vocabulary varies by partner; normalise to our own statuses. */
function mapCourierStatus(raw: string): string | null {
  const s = raw.toLowerCase();
  if (s.includes("delivered")) return "delivered";
  if (s.includes("out for delivery")) return "out_for_delivery";
  if (s.includes("rto")) return s.includes("deliver") ? "rto_delivered" : "rto_initiated";
  if (s.includes("cancel")) return "cancelled";
  if (s.includes("picked")) return "picked_up";
  if (s.includes("transit") || s.includes("shipped")) return "in_transit";
  return null;
}

/**
 * Propagates a forward shipment's state onto its order, and notifies the
 * customer on the two transitions they care about.
 */
async function syncOrderFromShipment(shipment: any, settings: any) {
  if (shipment.direction !== "forward") return;

  const order = await Order.findById(shipment.order);
  if (!order) return;

  order.awb = shipment.awb;
  order.courierName = shipment.courierName;
  order.trackingUrl = shipment.trackingUrl;

  const notifyBase = {
    recipient: {
      email: order.guestEmail || undefined,
      phone: order.shippingAddress.phone,
      userId: order.user ? String(order.user) : undefined,
    },
    orderId: String(order._id),
    settings,
    context: {
      customerName: order.shippingAddress.fullName,
      orderNumber: order.orderNumber,
      orderUrl: absoluteUrl(`/track-order?order=${order.orderNumber}`),
      total: order.total,
      awb: shipment.awb,
      courierName: shipment.courierName,
      trackingUrl: shipment.trackingUrl,
    },
  };

  if (shipment.status === "out_for_delivery" && order.orderStatus !== "out_for_delivery") {
    order.orderStatus = "out_for_delivery";
    order.statusHistory.push({ status: "out_for_delivery", at: new Date() });
    await notify({ event: "out_for_delivery", ...notifyBase });
  } else if (shipment.status === "delivered" && order.orderStatus !== "delivered") {
    order.orderStatus = "delivered";
    order.deliveredAt = shipment.deliveredAt ?? new Date();
    order.statusHistory.push({ status: "delivered", at: new Date() });
    // COD is collected on delivery, so the order is only paid at this point.
    if (order.paymentMethod === "cod" && order.paymentStatus === "pending") {
      order.paymentStatus = "paid";
    }
    await notify({ event: "order_delivered", ...notifyBase });
  }

  await order.save();
}
