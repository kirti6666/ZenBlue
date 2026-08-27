import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { AbandonedCart, Order, Product, Address, Coupon } from "@/models";
import { requireAuth, getCurrentUser } from "@/lib/middleware/requireAuth";
import { getSiteSettings } from "@/lib/site-settings";
import { sendOrderEmailWithInvoice } from "@/lib/invoice/email";
import { orderConfirmationEmail } from "@/lib/emailTemplates";
import { adjustStock, variantKey } from "@/lib/inventory";
import { getWalletBalance, debitWallet, maxRedeemable } from "@/lib/wallet";
import { notify } from "@/lib/notifications/dispatch";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

interface CheckoutItemInput {
  productId: string;
  quantity: number;
  variant?: Record<string, string>;
}

/**
 * A guest supplies their address inline; a logged-in customer references a
 * saved one. Both paths converge on the same validated shipping address.
 */
const guestAddressSchema = z.object({
  fullName: z.string().min(2, "Enter the recipient's name").max(120),
  phone: z.string().min(10, "Enter a valid phone number").max(20),
  line1: z.string().min(3, "Enter the address").max(200),
  line2: z.string().max(200).optional().default(""),
  city: z.string().min(2, "Enter the city").max(80),
  state: z.string().min(2, "Enter the state").max(80),
  pincode: z.string().min(6, "Enter a valid pincode").max(10),
});

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const limit = Math.min(50, Number(searchParams.get("limit") ?? 20));
    const status = searchParams.get("status");

    // Customers only ever see their own orders; admins and staff see everything.
    const isStaff = user.role === "admin" || user.role === "staff";
    const filter: Record<string, unknown> = isStaff ? {} : { user: user.id };
    if (status) filter.orderStatus = status;

    let query = Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
    // Staff need to see who placed each order; customers already know it's theirs.
    if (isStaff) {
      query = query.populate("user", "name email");
    } else {
      // Internal notes are staff-only and must never reach a customer's list.
      query = query.select("-internalNotes");
    }

    const [orders, total] = await Promise.all([query.lean(), Order.countDocuments(filter)]);

    return NextResponse.json({
      orders,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("List orders error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Guest checkout is supported, so a missing user is not an error here — the
  // caller must instead supply a contact email and an inline address.
  const user = await getCurrentUser(req);

  try {
    const body = await req.json();
    const items: CheckoutItemInput[] = Array.isArray(body.items) ? body.items : [];
    const addressId: string | undefined = body.addressId;
    const paymentMethod: string = body.paymentMethod;
    const couponCode: string | undefined = body.couponCode;
    const guestEmail: string | undefined = body.guestEmail?.trim();
    const requestedWalletUse: number = Number(body.walletAmount ?? 0);
    const cartToken: string | undefined = body.cartToken;

    if (items.length === 0) {
      return NextResponse.json({ error: "Your cart is empty" }, { status: 400 });
    }

    // This route completes COD orders. Prepaid orders are created by
    // /api/payments/razorpay/create-order, which owns the signature flow.
    if (paymentMethod !== "cod") {
      return NextResponse.json(
        { error: "Select Cash on Delivery here, or pay online to complete a prepaid order." },
        { status: 400 }
      );
    }

    await connectDB();
    const settings = await getSiteSettings();

    if (!settings.commerce.codEnabled) {
      return NextResponse.json(
        { error: "Cash on delivery is currently unavailable" },
        { status: 400 }
      );
    }

    // ---- Resolve the shipping address -----------------------------------
    let shippingAddress;
    if (user && addressId) {
      const address = await Address.findById(addressId);
      if (!address || address.user.toString() !== user.id) {
        return NextResponse.json({ error: "Address not found" }, { status: 404 });
      }
      shippingAddress = {
        fullName: address.fullName,
        phone: address.phone,
        line1: address.line1,
        line2: address.line2,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
      };
    } else {
      const parsed = guestAddressSchema.safeParse(body.address ?? {});
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
      }
      if (!user && !guestEmail) {
        return NextResponse.json(
          { error: "Enter an email address so we can send your order confirmation" },
          { status: 400 }
        );
      }
      shippingAddress = parsed.data;
    }

    // ---- Recompute every line from the database -------------------------
    // The client only says WHICH products and how many; prices, stock and tax
    // are always read server-side. Nothing from the cart payload is trusted.
    const orderItems = [];
    const stockMovements: { productId: string; variantKey: string; quantity: number }[] = [];
    let subtotal = 0;
    let taxAmount = 0;

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product || !product.isActive) {
        return NextResponse.json(
          { error: "A product in your cart is no longer available" },
          { status: 400 }
        );
      }

      const hasVariants = product.variants.length > 0;
      let unitPrice = product.discountPrice ?? product.price;
      let availableStock = product.stock;
      let sku = product.sku ?? "";
      let key = "";

      if (hasVariants) {
        if (!item.variant) {
          return NextResponse.json(
            { error: `Please select options for ${product.title}` },
            { status: 400 }
          );
        }
        const combo = product.variantCombinations.find((c: any) =>
          product.variants.every(
            (v: any) => c.combination.get(v.name) === item.variant?.[v.name]
          )
        );
        if (!combo) {
          return NextResponse.json(
            { error: `Selected options for ${product.title} are no longer available` },
            { status: 400 }
          );
        }
        unitPrice = combo.price ?? unitPrice;
        availableStock = combo.stock;
        sku = combo.sku || sku;
        key = variantKey(item.variant);
      }

      if (item.quantity < 1 || item.quantity > availableStock) {
        return NextResponse.json(
          { error: `Not enough stock for ${product.title} (only ${availableStock} left)` },
          { status: 400 }
        );
      }

      const lineTotal = unitPrice * item.quantity;
      subtotal += lineTotal;

      // Prices are GST-inclusive by Indian retail convention, so the tax shown
      // here is extracted out of the price rather than added on top. The
      // authoritative per-line breakup is recomputed on the invoice.
      const rate = product.gstRate ?? 0;
      if (rate > 0) taxAmount += lineTotal - lineTotal / (1 + rate / 100);

      orderItems.push({
        product: product._id,
        title: product.title,
        price: unitPrice,
        quantity: item.quantity,
        image: product.images?.[0],
        variant: item.variant,
        hsnCode: product.hsnCode ?? "",
        gstRate: product.gstRate ?? null,
        sku,
      });

      stockMovements.push({
        productId: String(product._id),
        variantKey: key,
        quantity: item.quantity,
      });
    }

    // ---- Coupon ----------------------------------------------------------
    // Re-validated here rather than trusting the client's earlier
    // /api/coupons/apply response, since the cart may have changed since.
    let discount = 0;
    let appliedCouponCode: string | undefined;
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.trim().toUpperCase() });
      if (
        coupon &&
        coupon.isActive &&
        coupon.expiresAt >= new Date() &&
        (coupon.usageLimit === 0 || coupon.usedCount < coupon.usageLimit) &&
        subtotal >= coupon.minOrderValue
      ) {
        discount =
          coupon.discountType === "percent"
            ? Math.round((subtotal * coupon.value) / 100)
            : Math.min(coupon.value, subtotal);
        appliedCouponCode = coupon.code;
        coupon.usedCount += 1;
        await coupon.save();
      }
    }

    const shippingFee =
      subtotal - discount >= settings.commerce.freeShippingThreshold
        ? 0
        : settings.commerce.shippingFee + (settings.shipping.codExtraFee ?? 0);

    const payableBeforeCredit = Math.max(0, subtotal - discount + shippingFee);

    // ---- Store credit ----------------------------------------------------
    // Guests have no wallet. The redemption is capped server-side against the
    // real balance, so a tampered amount can never exceed what is held.
    let walletUsed = 0;
    if (user && requestedWalletUse > 0) {
      const balance = await getWalletBalance(user.id);
      walletUsed = Math.min(
        requestedWalletUse,
        maxRedeemable(balance, payableBeforeCredit, "cod")
      );
    }

    const total = Math.max(0, payableBeforeCredit - walletUsed);

    const order = await Order.create({
      user: user?.id,
      isGuest: !user,
      guestEmail: user ? undefined : guestEmail,
      guestPhone: user ? undefined : shippingAddress.phone,
      items: orderItems,
      shippingAddress,
      subtotal,
      discount,
      couponCode: appliedCouponCode,
      walletUsed,
      shippingFee,
      taxAmount: Math.round((taxAmount + Number.EPSILON) * 100) / 100,
      total,
      paymentMethod: "cod",
      paymentStatus: "pending",
      orderStatus: "placed",
      statusHistory: [{ status: "placed", note: "Order placed", at: new Date() }],
    });

    // ---- Post-order side effects ----------------------------------------
    // The order exists at this point. Everything below is recoverable if it
    // fails, so none of it is allowed to roll the order back.

    // Debit the wallet only after the order id exists, so the ledger entry can
    // reference the order it paid for.
    if (walletUsed > 0 && user) {
      try {
        await debitWallet({
          userId: user.id,
          amount: walletUsed,
          reason: "order_redemption",
          note: `Applied to ${order.orderNumber}`,
          orderId: String(order._id),
        });
      } catch (err) {
        // The cap above makes this near-impossible; if it does happen, the
        // customer must not get free product.
        console.error("[orders] wallet debit failed, reverting redemption:", err);
        order.walletUsed = 0;
        order.total = payableBeforeCredit;
        await order.save();
      }
    }

    // Stock goes through the inventory service so every decrement is recorded
    // in the same ledger as manual adjustments and returns.
    for (const movement of stockMovements) {
      const result = await adjustStock({
        productId: movement.productId,
        variantKey: movement.variantKey,
        delta: -movement.quantity,
        reason: "order_placed",
        note: order.orderNumber,
        orderId: String(order._id),
        suppressNotifications: true,
      });
      if (!result.ok) console.error("[orders] stock decrement failed:", result.error);
    }

    // Denormalized counter behind the Best Sellers rail.
    await Promise.all(
      stockMovements.map((m) =>
        Product.updateOne({ _id: m.productId }, { $inc: { salesCount: m.quantity } })
      )
    );

    // Close out the abandoned-cart row and attribute the recovery.
    if (cartToken) {
      await AbandonedCart.findOneAndUpdate(
        { cartToken },
        {
          $set: {
            status: "recovered",
            recoveredAt: new Date(),
            recoveredOrder: order._id,
            recoveredRevenue: total,
            nextStepAt: null,
          },
        }
      ).catch(() => undefined);
    }

    const contactEmail = user?.email ?? guestEmail;

    // Awaited so the send completes before this serverless function returns —
    // an un-awaited send can be dropped when the lambda freezes. The helper
    // catches its own errors, so a mail failure still never fails the order.
    if (contactEmail) {
      await sendOrderEmailWithInvoice({
        orderId: order._id.toString(),
        to: contactEmail,
        subject: `Order confirmed — ${order.orderNumber}`,
        html: orderConfirmationEmail(order),
      });
    }

    // WhatsApp and SMS, governed by the admin's per-event channel toggles.
    await notify({
      event: "order_placed",
      recipient: {
        email: contactEmail,
        phone: shippingAddress.phone,
        userId: user?.id,
      },
      orderId: String(order._id),
      settings,
      context: {
        customerName: shippingAddress.fullName,
        orderNumber: order.orderNumber,
        orderUrl: user
          ? absoluteUrl(`/account/orders/${order._id}`)
          : absoluteUrl(`/track-order?order=${order.orderNumber}`),
        total,
      },
    });

    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    console.error("Create order error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
