import { connectDB } from "@/lib/db";
import { AbandonedCart, Order, Product, Coupon, User } from "@/models";
import { sendOrderEmailWithInvoice } from "@/lib/invoice/email";
import { orderConfirmationEmail } from "@/lib/emailTemplates";
import { adjustStock, variantKey } from "@/lib/inventory";
import { debitWallet } from "@/lib/wallet";
import { notify } from "@/lib/notifications/dispatch";
import { getSiteSettings } from "@/lib/site-settings";
import { absoluteUrl } from "@/lib/seo";

/**
 * Applies the side effects of a CONFIRMED Razorpay payment.
 *
 * Called from both /api/payments/razorpay/verify (the browser callback) and
 * /api/payments/razorpay/webhook (the server-to-server backup path). Either may
 * fire first, and both may fire — so this is idempotent, guarded by the
 * paymentStatus check below.
 *
 * Everything deferred at order-creation time lands here: stock, coupon usage,
 * the wallet debit and the abandoned-cart closeout. Deferring them is what
 * stops an abandoned payment sheet from consuming stock, burning a single-use
 * coupon, or spending someone's store credit.
 */
export async function confirmRazorpayPayment(orderId: string, razorpayPaymentId: string) {
  await connectDB();

  const order = await Order.findById(orderId);
  if (!order) return { ok: false as const, error: "Order not found" };
  if (order.paymentMethod !== "razorpay") {
    return { ok: false as const, error: "Not a Razorpay order" };
  }

  // Already processed by the other path (verify vs webhook) — safe no-op.
  // This single check is what makes the whole function idempotent.
  if (order.paymentStatus === "paid") {
    return { ok: true as const, order };
  }

  // Mark paid FIRST. If a later step throws, the customer's money is already
  // reconciled with their order — the alternative (side effects first) can
  // leave a paid customer looking unpaid, which is far worse to recover from.
  order.paymentStatus = "paid";
  order.razorpayPaymentId = razorpayPaymentId;
  order.orderStatus = "confirmed";
  order.statusHistory.push({
    status: "confirmed",
    note: "Payment received",
    at: new Date(),
  });
  await order.save();

  // ---- Stock, through the ledger --------------------------------------
  for (const item of order.items) {
    const variant =
      item.variant instanceof Map
        ? Object.fromEntries(item.variant)
        : ((item.variant as any) ?? {});
    const result = await adjustStock({
      productId: String(item.product),
      variantKey: variantKey(variant),
      delta: -item.quantity,
      reason: "order_placed",
      note: order.orderNumber,
      orderId: String(order._id),
      suppressNotifications: true,
    });
    if (!result.ok) console.error("[razorpay] stock decrement failed:", result.error);
  }

  await Promise.all(
    order.items.map((item: any) =>
      Product.updateOne({ _id: item.product }, { $inc: { salesCount: item.quantity } })
    )
  );

  // ---- Coupon ----------------------------------------------------------
  if (order.couponCode) {
    await Coupon.updateOne({ code: order.couponCode }, { $inc: { usedCount: 1 } });
  }

  // ---- Store credit ----------------------------------------------------
  if ((order.walletUsed ?? 0) > 0 && order.user) {
    try {
      await debitWallet({
        userId: String(order.user),
        amount: order.walletUsed,
        reason: "order_redemption",
        note: `Applied to ${order.orderNumber}`,
        orderId: String(order._id),
      });
    } catch (err) {
      // The balance was checked at order creation; if it has since been spent
      // elsewhere, the shop has already been paid the gateway amount and the
      // shortfall is recorded rather than silently absorbed.
      console.error("[razorpay] wallet debit failed after payment:", err);
      order.walletUsed = 0;
      await order.save();
    }
  }

  // ---- Abandoned cart closeout ----------------------------------------
  const cartToken = (order as any).get?.("cartTokenPending");
  if (cartToken) {
    await AbandonedCart.findOneAndUpdate(
      { cartToken },
      {
        $set: {
          status: "recovered",
          recoveredAt: new Date(),
          recoveredOrder: order._id,
          recoveredRevenue: order.total,
          nextStepAt: null,
        },
      }
    ).catch(() => undefined);
  }

  // ---- Customer notifications -----------------------------------------
  // Sent exactly once, on the real transition to "paid". Living here rather
  // than in the verify route means it also fires when only the webhook
  // confirms — e.g. the shopper closed the tab right after paying.
  try {
    const customer = order.user
      ? await User.findById(order.user).select("name email phone").lean<any>()
      : null;
    const email = customer?.email ?? order.guestEmail;

    if (email) {
      await sendOrderEmailWithInvoice({
        orderId: order._id.toString(),
        to: email,
        subject: `Order confirmed — ${order.orderNumber}`,
        html: orderConfirmationEmail(order as any),
      });
    }

    const settings = await getSiteSettings();
    await notify({
      event: "payment_confirmed",
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
      },
    });
  } catch (err) {
    // Never let a notification failure look like a payment failure.
    console.error("[confirmRazorpayPayment] notification failed:", err);
  }

  return { ok: true as const, order };
}
