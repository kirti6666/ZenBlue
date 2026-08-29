import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Order, ReturnRequest } from "@/models";
import { getCurrentUser } from "@/lib/middleware/requireAuth";
import { requireAdmin } from "@/lib/middleware/requireAdmin";
import { getSiteSettings } from "@/lib/site-settings";
import { absoluteUrl } from "@/lib/seo";
import { notify } from "@/lib/notifications/dispatch";
import {
  checkReturnEligibility,
  computeRefundAmount,
  generateRmaNumber,
  pushTimeline,
  syncOrderReturnedQuantities,
} from "@/lib/returns";
import { variantKey as toVariantKey } from "@/lib/inventory";

// Reads cookies/query params per request — never statically rendered.
export const dynamic = "force-dynamic";

const createSchema = z.object({
  orderId: z.string().min(1),
  type: z.enum(["return", "exchange"]).default("return"),
  reason: z.enum([
    "size_fit_issue",
    "damaged_or_defective",
    "wrong_item_received",
    "not_as_described",
    "quality_not_expected",
    "changed_mind",
    "other",
  ]),
  comments: z.string().max(2000).optional().default(""),
  images: z.array(z.string().url()).max(6).optional().default([]),
  items: z
    .array(
      z.object({
        product: z.string().min(1),
        variantKey: z.string().optional().default(""),
        quantity: z.number().int().min(1),
        /** Only for exchanges — the variant the customer wants instead. */
        exchangeVariant: z.record(z.string()).optional(),
      })
    )
    .min(1, "Select at least one item to return"),
});

/**
 * Customer raises a return or exchange request.
 *
 * Every quantity and price is re-derived from the ORDER, never taken from the
 * request body — the client only says which lines and how many. That is the
 * same rule the checkout follows, and it is what stops a crafted request from
 * claiming a refund larger than what was paid.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ error: "Please log in" }, { status: 401 });

    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    await connectDB();
    const settings = await getSiteSettings();

    const order = (await Order.findOne({ _id: parsed.data.orderId, user: user.id }).lean()) as any;
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    if (parsed.data.type === "exchange" && !settings.returns.exchangeEnabled) {
      return NextResponse.json({ error: "Exchanges are not available" }, { status: 400 });
    }

    const existing = await ReturnRequest.find({ order: parsed.data.orderId }).lean();
    const eligibility = checkReturnEligibility(order, settings, existing);
    if (!eligibility.eligible) {
      return NextResponse.json({ error: eligibility.reason }, { status: 400 });
    }

    // Match each requested line against what the order actually allows.
    const items = [];
    for (const requested of parsed.data.items) {
      const line = eligibility.returnableItems.find(
        (l) => l.product === requested.product && l.variantKey === (requested.variantKey ?? "")
      );
      if (!line) {
        return NextResponse.json(
          { error: "One of the selected items is not on this order" },
          { status: 400 }
        );
      }
      if (requested.quantity > line.returnableQuantity) {
        return NextResponse.json(
          { error: `You can return at most ${line.returnableQuantity} of "${line.title}"` },
          { status: 400 }
        );
      }

      items.push({
        product: line.product,
        title: line.title,
        image: line.image,
        variant: line.variant,
        variantKey: line.variantKey,
        quantity: requested.quantity,
        unitPrice: line.unitPrice,
        exchangeVariant: requested.exchangeVariant,
        exchangeVariantKey: requested.exchangeVariant ? toVariantKey(requested.exchangeVariant) : "",
      });
    }

    // Damaged/wrong-item cases are our fault, so shipping is refunded too.
    const ourFault =
      parsed.data.reason === "damaged_or_defective" || parsed.data.reason === "wrong_item_received";
    const refundAmount = computeRefundAmount(order, items, { includeShipping: ourFault });

    const doc = new ReturnRequest({
      rmaNumber: await generateRmaNumber(),
      order: order._id,
      user: user.id,
      type: parsed.data.type,
      status: "requested",
      items,
      reason: parsed.data.reason,
      comments: parsed.data.comments,
      images: parsed.data.images,
      refundAmount,
      resolution: "pending",
      refundStatus: "not_applicable",
    });
    pushTimeline(doc, "requested", "Request raised by customer", user.id);
    await doc.save();

    await syncOrderReturnedQuantities(String(order._id));

    await notify({
      event: "return_requested",
      recipient: { email: user.email, userId: user.id },
      orderId: String(order._id),
      settings,
      context: {
        customerName: order.shippingAddress?.fullName ?? "there",
        orderNumber: order.orderNumber,
        orderUrl: absoluteUrl(`/account/returns/${doc._id}`),
        total: order.total,
      },
    });

    return NextResponse.json({ returnRequest: doc.toObject() }, { status: 201 });
  } catch (err) {
    console.error("Create return request error:", err);
    return NextResponse.json({ error: "Could not raise the request" }, { status: 500 });
  }
}

/**
 * Lists return requests.
 *
 * Customers see only their own. Admins get every request plus filters — the
 * same endpoint backs both, with the scope decided by the caller's role rather
 * than by a query parameter a customer could set.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ error: "Please log in" }, { status: 401 });

    await connectDB();
    const { searchParams } = new URL(req.url);
    const isAdmin = user.role === "admin" || user.role === "staff";

    const filter: Record<string, unknown> = isAdmin ? {} : { user: user.id };

    if (isAdmin) {
      const status = searchParams.get("status");
      const type = searchParams.get("type");
      if (status) filter.status = status;
      if (type) filter.type = type;
    }

    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const limit = Math.min(100, Number(searchParams.get("limit") ?? 25));

    const [requests, total] = await Promise.all([
      ReturnRequest.find(filter)
        .populate("order", "orderNumber total paymentMethod paymentStatus createdAt")
        .populate("replacementOrder", "orderNumber orderStatus paymentStatus total createdAt")
        .populate("user", "name email phone")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ReturnRequest.countDocuments(filter),
    ]);

    return NextResponse.json({
      requests,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("List returns error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
