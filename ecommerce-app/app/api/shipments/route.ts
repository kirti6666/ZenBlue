import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Order, Product, ReturnRequest, Shipment } from "@/models";
import { requireAdmin } from "@/lib/middleware/requireAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { logAdminAction, getClientIp } from "@/lib/middleware/logAdminAction";
import { getSiteSettings } from "@/lib/site-settings";
import { getShippingProvider } from "@/lib/shipping/provider";
import { notify } from "@/lib/notifications/dispatch";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  orderId: z.string().min(1),
  returnRequestId: z.string().optional(),
  direction: z.enum(["forward", "reverse"]).default("forward"),
  courierId: z.string().optional(),
  /** Manual mode: staff paste the AWB they booked on the courier's dashboard. */
  manualAwb: z.string().max(120).optional(),
  manualCourierName: z.string().max(120).optional(),
  manualTrackingUrl: z.string().max(500).optional(),
  weightKg: z.number().min(0.01).optional(),
  lengthCm: z.number().min(0).optional(),
  breadthCm: z.number().min(0).optional(),
  heightCm: z.number().min(0).optional(),
});

/**
 * Books a shipment for an order (or a reverse pickup for a return).
 *
 * Package dimensions default to the per-product values, falling back to the
 * store defaults in Site Settings. Weight is summed across the order's lines
 * because couriers bill on the whole consignment, not per item.
 *
 * When the selected provider has no live API (or is set to `manual`), the
 * Shipment row is still created with whatever AWB the admin supplies — the
 * order screens and customer tracker behave identically either way.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, PERMISSIONS.SHIPPING);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    await connectDB();
    const settings = await getSiteSettings();
    const data = parsed.data;

    const order = await Order.findById(data.orderId);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    // Sum real package weight from the catalogue rather than assuming a flat
    // figure — under-declaring weight is the usual cause of courier surcharges.
    const productIds = order.items.map((i: any) => i.product);
    const products = await Product.find({ _id: { $in: productIds } })
      .select("weightKg packageLengthCm packageBreadthCm packageHeightCm hsnCode sku")
      .lean();
    const byId = new Map(products.map((p: any) => [String(p._id), p]));

    const computedWeight = order.items.reduce((sum: number, item: any) => {
      const p = byId.get(String(item.product));
      return sum + (p?.weightKg ?? settings.shipping.defaultWeightKg) * item.quantity;
    }, 0);

    const weightKg = data.weightKg ?? Math.max(computedWeight, 0.1);
    const lengthCm = data.lengthCm ?? settings.shipping.defaultLengthCm;
    const breadthCm = data.breadthCm ?? settings.shipping.defaultBreadthCm;
    const heightCm = data.heightCm ?? settings.shipping.defaultHeightCm;

    const provider = getShippingProvider(settings);
    const codAmount = order.paymentMethod === "cod" && order.paymentStatus !== "paid" ? order.total : 0;

    let result = await provider.createShipment({
      orderNumber: order.orderNumber,
      direction: data.direction,
      courierId: data.courierId,
      pickupLocation: settings.shipping.pickupLocationName,
      consignee: {
        name: order.shippingAddress.fullName,
        phone: order.shippingAddress.phone,
        email: order.guestEmail || undefined,
        line1: order.shippingAddress.line1,
        line2: order.shippingAddress.line2,
        city: order.shippingAddress.city,
        state: order.shippingAddress.state,
        pincode: order.shippingAddress.pincode,
      },
      items: order.items.map((i: any) => ({
        name: i.title,
        sku: i.sku || byId.get(String(i.product))?.sku || "",
        quantity: i.quantity,
        unitPrice: i.price,
        hsn: i.hsnCode || byId.get(String(i.product))?.hsnCode || "",
      })),
      weightKg,
      lengthCm,
      breadthCm,
      heightCm,
      declaredValue: order.total,
      codAmount,
    });

    // A manually supplied AWB always wins — it is what the courier actually
    // issued, and it lets staff recover from a failed API booking.
    if (data.manualAwb) {
      result = {
        ok: true,
        awb: data.manualAwb,
        courierName: data.manualCourierName ?? result.courierName ?? "",
        trackingUrl: data.manualTrackingUrl ?? result.trackingUrl ?? "",
        providerShipmentId: result.providerShipmentId,
        raw: result.raw,
      };
    }

    if (!result.ok && !data.manualAwb) {
      return NextResponse.json(
        { error: result.error ?? "The courier could not create this shipment" },
        { status: 400 }
      );
    }

    const shipment = await Shipment.create({
      order: order._id,
      returnRequest: data.returnRequestId,
      direction: data.direction,
      provider: provider.name,
      courierName: result.courierName ?? "",
      providerShipmentId: result.providerShipmentId ?? "",
      awb: result.awb ?? "",
      trackingUrl: result.trackingUrl ?? "",
      labelUrl: result.labelUrl ?? "",
      status: result.awb ? "awb_assigned" : "created",
      weightKg,
      lengthCm,
      breadthCm,
      heightCm,
      codAmount,
      providerResponse: result.raw,
      createdBy: admin.id,
    });

    if (data.direction === "forward") {
      // Denormalize onto the order so listings and emails need no join.
      order.awb = result.awb ?? "";
      order.courierName = result.courierName ?? "";
      order.trackingUrl = result.trackingUrl ?? "";
      if (order.orderStatus !== "shipped") {
        order.orderStatus = "shipped";
        order.shippedAt = new Date();
        order.statusHistory.push({
          status: "shipped",
          note: `AWB ${result.awb ?? "pending"}`,
          at: new Date(),
        });
      }
      await order.save();

      await notify({
        event: "order_shipped",
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
          awb: result.awb,
          courierName: result.courierName,
          trackingUrl: result.trackingUrl,
        },
      });
    } else if (data.returnRequestId) {
      await ReturnRequest.findByIdAndUpdate(data.returnRequestId, {
        $set: {
          "reversePickup.courier": result.courierName ?? "",
          "reversePickup.awb": result.awb ?? "",
          "reversePickup.trackingUrl": result.trackingUrl ?? "",
          status: "pickup_scheduled",
        },
      });
    }

    await logAdminAction({
      adminId: admin.id,
      action: "SHIPMENT_CREATE",
      targetType: "Shipment",
      targetId: String(shipment._id),
      changes: { after: { awb: shipment.awb, direction: data.direction } },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ shipment: shipment.toObject() }, { status: 201 });
  } catch (err) {
    console.error("Create shipment error:", err);
    return NextResponse.json({ error: "Could not create the shipment" }, { status: 500 });
  }
}

/** Admin shipment list, filterable by status and direction. */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, PERMISSIONS.SHIPPING);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await connectDB();
  const { searchParams } = new URL(req.url);
  const filter: Record<string, unknown> = {};
  const status = searchParams.get("status");
  const direction = searchParams.get("direction");
  if (status) filter.status = status;
  if (direction) filter.direction = direction;

  const shipments = await Shipment.find(filter)
    .populate("order", "orderNumber total shippingAddress paymentMethod")
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  return NextResponse.json({ shipments });
}
