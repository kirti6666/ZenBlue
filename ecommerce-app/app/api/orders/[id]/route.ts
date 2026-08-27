import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Order, User } from "@/models";
import { requireAuth, getCurrentUser } from "@/lib/middleware/requireAuth";
import { requireAdmin } from "@/lib/middleware/requireAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { logAdminAction, getClientIp } from "@/lib/middleware/logAdminAction";
import { getSiteSettings } from "@/lib/site-settings";
import { notify } from "@/lib/notifications/dispatch";
import { absoluteUrl } from "@/lib/seo";
import { adjustStock, variantKey } from "@/lib/inventory";
import { creditWallet } from "@/lib/wallet";
import { issueCreditNote } from "@/lib/invoice/creditNote";

export const dynamic = "force-dynamic";

const ORDER_STATUSES = [
  "placed",
  "confirmed",
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "returned",
] as const;

const PAYMENT_STATUSES = [
  "pending",
  "paid",
  "failed",
  "refunded",
  "partially_refunded",
] as const;

/** Which customer-facing notification, if any, a status change should fire. */
const STATUS_EVENTS: Record<string, "order_confirmed" | "order_delivered" | "order_cancelled"> = {
  confirmed: "order_confirmed",
  delivered: "order_delivered",
  cancelled: "order_cancelled",
};

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();

    const order = await Order.findById(params.id).lean<any>();
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const isOwner = order.user?.toString() === user.id;
    const isStaff = user.role === "admin" || user.role === "staff";
    if (!isOwner && !isStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Internal notes are staff-only — they are where "customer disputes every
    // delivery" gets written, and must never reach the customer's own view.
    if (!isStaff) delete order.internalNotes;

    return NextResponse.json({ order });
  } catch (err) {
    console.error("Get order error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

const updateSchema = z.object({
  orderStatus: z.enum(ORDER_STATUSES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  internalNotes: z.string().max(4000).optional(),
  note: z.string().max(500).optional(),
  cancellationReason: z.string().max(500).optional(),
  /** On cancellation: put the reserved units back on the shelf. */
  restock: z.boolean().optional().default(true),
  /** On cancellation of a paid order: refund as store credit instead of to source. */
  refundAsStoreCredit: z.boolean().optional().default(false),
});

/**
 * Admin order management: status, payment status, internal notes and
 * cancellation.
 *
 * Cancellation is the interesting path — it is not just a status flag. It
 * returns stock through the inventory ledger, refunds any money already taken
 * (to source or as store credit), issues a GST credit note against the original
 * invoice, and notifies the customer. Doing any subset of those leaves the
 * books, the shelf and the customer disagreeing with each other.
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(req, PERMISSIONS.ORDERS);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const data = parsed.data;

    if (!data.orderStatus && !data.paymentStatus && data.internalNotes === undefined) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    await connectDB();
    const settings = await getSiteSettings();

    const order = await Order.findById(params.id);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const before = {
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
    };

    // Cancelling something already delivered would strand the goods with the
    // customer while crediting them — that belongs in the returns flow.
    if (data.orderStatus === "cancelled" && order.orderStatus === "delivered") {
      return NextResponse.json(
        { error: "A delivered order must be handled as a return, not a cancellation" },
        { status: 400 }
      );
    }
    if (order.orderStatus === "cancelled" && data.orderStatus && data.orderStatus !== "cancelled") {
      return NextResponse.json(
        { error: "A cancelled order cannot be reopened — place a new order instead" },
        { status: 400 }
      );
    }

    if (data.internalNotes !== undefined) order.internalNotes = data.internalNotes;
    if (data.paymentStatus) order.paymentStatus = data.paymentStatus;

    let creditIssued = 0;

    if (data.orderStatus && data.orderStatus !== order.orderStatus) {
      order.orderStatus = data.orderStatus;
      order.statusHistory.push({
        status: data.orderStatus,
        note: data.note ?? data.cancellationReason ?? "",
        at: new Date(),
      });

      if (data.orderStatus === "shipped" && !order.shippedAt) order.shippedAt = new Date();
      if (data.orderStatus === "delivered") {
        order.deliveredAt = order.deliveredAt ?? new Date();
        // COD is collected on the doorstep, so delivery is the payment event.
        if (order.paymentMethod === "cod" && order.paymentStatus === "pending") {
          order.paymentStatus = "paid";
        }
      }

      if (data.orderStatus === "cancelled") {
        order.cancelledAt = new Date();
        order.cancellationReason = data.cancellationReason ?? "";

        if (data.restock) {
          for (const item of order.items) {
            const variant =
              item.variant instanceof Map
                ? Object.fromEntries(item.variant)
                : ((item.variant as any) ?? {});
            const result = await adjustStock({
              productId: String(item.product),
              variantKey: variantKey(variant),
              delta: item.quantity,
              reason: "order_cancelled",
              note: `Cancelled ${order.orderNumber}`,
              orderId: String(order._id),
              performedBy: admin.id,
            });
            if (!result.ok) console.error("[orders] cancel restock failed:", result.error);
          }
        }

        // Store credit spent on the order is always returned — the customer
        // paid with it and is receiving nothing.
        if (order.walletUsed > 0 && order.user) {
          await creditWallet({
            userId: String(order.user),
            amount: order.walletUsed,
            reason: "redemption_reversal",
            note: `Cancelled ${order.orderNumber}`,
            orderId: String(order._id),
            performedBy: admin.id,
          }).catch((err) => console.error("[orders] credit reversal failed:", err));
        }

        // Money actually taken has to go back too.
        if (order.paymentStatus === "paid" && order.total > 0) {
          if (data.refundAsStoreCredit && order.user) {
            await creditWallet({
              userId: String(order.user),
              amount: order.total,
              reason: "order_cancellation",
              note: `Cancelled ${order.orderNumber}`,
              orderId: String(order._id),
              performedBy: admin.id,
            }).catch((err) => console.error("[orders] cancellation credit failed:", err));
            creditIssued = order.total;
          }
          order.refundedAmount = (order.refundedAmount ?? 0) + order.total;
          order.paymentStatus = "refunded";

          // A paid order that is reversed needs a credit note against its
          // invoice, exactly as an approved return does.
          await issueCreditNote({
            orderId: String(order._id),
            amount: order.total,
            reason: `Cancellation — ${data.cancellationReason || "order cancelled"}`,
          }).catch((err) => console.error("[orders] credit note failed:", err));
        }
      }
    }

    await order.save();

    await logAdminAction({
      adminId: admin.id,
      action: data.orderStatus === "cancelled" ? "ORDER_CANCEL" : "ORDER_STATUS_UPDATE",
      targetType: "Order",
      targetId: params.id,
      changes: {
        before,
        after: { orderStatus: order.orderStatus, paymentStatus: order.paymentStatus },
      },
      ipAddress: getClientIp(req),
    });

    // Notify only on order-status changes the customer cares about. A
    // payment-status correction or an internal note is not one of them.
    const event = data.orderStatus ? STATUS_EVENTS[data.orderStatus] : undefined;
    if (event) {
      const customer = order.user
        ? await User.findById(order.user).select("name email phone").lean<any>()
        : null;

      const email = customer?.email ?? order.guestEmail;
      if (email || order.shippingAddress.phone) {
        await notify({
          event,
          recipient: {
            email: email || undefined,
            phone: customer?.phone || order.shippingAddress.phone,
            userId: order.user ? String(order.user) : undefined,
          },
          orderId: String(order._id),
          settings,
          context: {
            customerName: customer?.name ?? order.shippingAddress.fullName,
            orderNumber: order.orderNumber,
            orderUrl: order.user
              ? absoluteUrl(`/account/orders/${order._id}`)
              : absoluteUrl(`/track-order?order=${order.orderNumber}`),
            total: order.total,
            amount: creditIssued || order.total,
            reason: order.cancellationReason,
            awb: order.awb,
            courierName: order.courierName,
            trackingUrl: order.trackingUrl,
          },
        });
      }
    }

    return NextResponse.json({ order: order.toObject() });
  } catch (err) {
    console.error("Update order error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

/**
 * Customer-initiated cancellation, allowed only before dispatch.
 *
 * Delegates to the same admin path so a customer cancelling and staff
 * cancelling produce identical stock, refund and credit-note outcomes.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Please log in" }, { status: 401 });

  try {
    await connectDB();
    const order = await Order.findOne({ _id: params.id, user: user.id });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    if (!["placed", "confirmed", "processing"].includes(order.orderStatus)) {
      return NextResponse.json(
        { error: "This order has already been dispatched — please raise a return instead" },
        { status: 400 }
      );
    }

    const settings = await getSiteSettings();

    order.orderStatus = "cancelled";
    order.cancelledAt = new Date();
    order.cancellationReason = "Cancelled by customer";
    order.statusHistory.push({
      status: "cancelled",
      note: "Cancelled by customer",
      at: new Date(),
    });

    for (const item of order.items) {
      const variant =
        item.variant instanceof Map
          ? Object.fromEntries(item.variant)
          : ((item.variant as any) ?? {});
      await adjustStock({
        productId: String(item.product),
        variantKey: variantKey(variant),
        delta: item.quantity,
        reason: "order_cancelled",
        note: `Cancelled ${order.orderNumber}`,
        orderId: String(order._id),
        performedBy: user.id,
      });
    }

    if (order.walletUsed > 0) {
      await creditWallet({
        userId: user.id,
        amount: order.walletUsed,
        reason: "redemption_reversal",
        note: `Cancelled ${order.orderNumber}`,
        orderId: String(order._id),
      }).catch((err) => console.error("[orders] credit reversal failed:", err));
    }

    // A prepaid order that is cancelled is refunded as store credit
    // immediately; a gateway refund is raised by staff from the admin.
    if (order.paymentStatus === "paid" && order.total > 0) {
      await creditWallet({
        userId: user.id,
        amount: order.total,
        reason: "order_cancellation",
        note: `Cancelled ${order.orderNumber}`,
        orderId: String(order._id),
      }).catch((err) => console.error("[orders] cancellation credit failed:", err));
      order.refundedAmount = order.total;
      order.paymentStatus = "refunded";

      await issueCreditNote({
        orderId: String(order._id),
        amount: order.total,
        reason: "Cancelled by customer",
      }).catch((err) => console.error("[orders] credit note failed:", err));
    }

    await order.save();

    await notify({
      event: "order_cancelled",
      recipient: { email: user.email, phone: order.shippingAddress.phone, userId: user.id },
      orderId: String(order._id),
      settings,
      context: {
        customerName: order.shippingAddress.fullName,
        orderNumber: order.orderNumber,
        orderUrl: absoluteUrl(`/account/orders/${order._id}`),
        total: order.total,
        reason: "Cancelled by you",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Cancel order error:", err);
    return NextResponse.json({ error: "Could not cancel this order" }, { status: 500 });
  }
}
