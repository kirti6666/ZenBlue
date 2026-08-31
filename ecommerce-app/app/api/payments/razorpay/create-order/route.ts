import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Order, Product, Address, Coupon } from "@/models";
import { getCurrentUser } from "@/lib/middleware/requireAuth";
import { getSiteSettings } from "@/lib/site-settings";
import { getWalletBalance, maxRedeemable } from "@/lib/wallet";
import { variantKey } from "@/lib/inventory";
import razorpay from "@/lib/razorpay";

export const dynamic = "force-dynamic";

interface CheckoutItemInput {
  productId: string;
  quantity: number;
  variant?: Record<string, string>;
}

/** Mirrors the guest schema in /api/orders so both payment paths validate alike. */
const guestAddressSchema = z.object({
  fullName: z.string().min(2, "Enter the recipient's name").max(120),
  phone: z.string().min(10, "Enter a valid phone number").max(20),
  line1: z.string().min(3, "Enter the address").max(200),
  line2: z.string().max(200).optional().default(""),
  city: z.string().min(2, "Enter the city").max(80),
  state: z.string().min(2, "Enter the state").max(80),
  pincode: z.string().min(6, "Enter a valid pincode").max(10),
});

/**
 * Creates a pending order and the matching Razorpay order.
 *
 * This is the prepaid twin of the COD path in /api/orders and deliberately
 * mirrors it — guest checkout, store credit, per-line HSN/GST and
 * settings-driven shipping all behave identically, so a shopper's total does
 * not change based on how they chose to pay.
 *
 * The one real difference is WHEN side effects land. Stock, coupon usage and
 * the wallet debit are all deferred to confirmRazorpayPayment(), because a
 * shopper who opens the payment sheet and closes it must not consume stock,
 * burn a single-use coupon, or lose store credit. The order row exists in
 * `pending` until payment confirms it.
 */
export async function POST(req: NextRequest) {
  // Guest checkout is supported here too — the caller supplies contact details
  // instead of a session.
  const user = await getCurrentUser(req);

  try {
    const body = await req.json();
    const items: CheckoutItemInput[] = Array.isArray(body.items) ? body.items : [];
    const addressId: string | undefined = body.addressId;
    const couponCode: string | undefined = body.couponCode;
    const guestEmail: string | undefined = body.guestEmail?.trim();
    const requestedWalletUse: number = Number(body.walletAmount ?? 0);
    const cartToken: string | undefined = body.cartToken;

    if (items.length === 0) {
      return NextResponse.json({ error: "Your cart is empty" }, { status: 400 });
    }

    await connectDB();
    const settings = await getSiteSettings();

    if (!settings.commerce.razorpayEnabled) {
      return NextResponse.json({ error: "Online payment is currently unavailable" }, { status: 400 });
    }

    // ---- Shipping address ------------------------------------------------
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

    // ---- Recompute every line from the database --------------------------
    // Stock is validated here but NOT decremented — see the note above.
    const orderItems = [];
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
      let lineImage = product.images?.[0] ?? "";

      if (hasVariants) {
        if (!item.variant) {
          return NextResponse.json(
            { error: `Please select options for ${product.title}` },
            { status: 400 }
          );
        }
        const combo = product.variantCombinations.find((c: any) =>
          product.variants.every((v: any) => c.combination.get(v.name) === item.variant?.[v.name])
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
        const colourAttribute = product.variants.find((variant: any) =>
          /colou?r/i.test(variant.name)
        );
        const colourImage = colourAttribute
          ? product.variantCombinations.find(
              (candidate: any) =>
                candidate.combination.get(colourAttribute.name) ===
                  item.variant?.[colourAttribute.name] && candidate.image
            )?.image
          : undefined;
        lineImage = combo.image || colourImage || lineImage;
      }

      if (item.quantity < 1 || item.quantity > availableStock) {
        return NextResponse.json(
          { error: `Not enough stock for ${product.title} (only ${availableStock} left)` },
          { status: 400 }
        );
      }

      const lineTotal = unitPrice * item.quantity;
      subtotal += lineTotal;

      const rate = product.gstRate ?? 0;
      if (rate > 0) taxAmount += lineTotal - lineTotal / (1 + rate / 100);

      orderItems.push({
        product: product._id,
        title: product.title,
        price: unitPrice,
        quantity: item.quantity,
        image: lineImage,
        variant: item.variant,
        hsnCode: product.hsnCode ?? "",
        gstRate: product.gstRate ?? null,
        sku,
      });
    }

    // ---- Coupon ----------------------------------------------------------
    // Validated now, but usedCount is only incremented once payment confirms —
    // a coupon should not be spent on a checkout the shopper never completes.
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
      }
    }

    // ZenBlue ships every website order free.
    const shippingFee = 0;

    const payableBeforeCredit = Math.max(0, subtotal - discount + shippingFee);

    // ---- Store credit ----------------------------------------------------
    // Recorded on the order but NOT debited yet. maxRedeemable leaves at least
    // ₹1 on a prepaid order, because Razorpay rejects a zero-amount order.
    let walletUsed = 0;
    if (user && requestedWalletUse > 0) {
      const balance = await getWalletBalance(user.id);
      walletUsed = Math.min(
        requestedWalletUse,
        maxRedeemable(balance, payableBeforeCredit, "razorpay")
      );
    }

    const total = Math.max(1, payableBeforeCredit - walletUsed);

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
      paymentMethod: "razorpay",
      paymentStatus: "pending",
      orderStatus: "placed",
      recoveredFromCart: undefined,
      statusHistory: [{ status: "placed", note: "Awaiting payment", at: new Date() }],
    });

    // Stashed so confirmRazorpayPayment can close out the abandoned-cart row
    // only if the payment actually succeeds.
    if (cartToken) {
      order.set("cartTokenPending", cartToken, { strict: false });
      await order.save();
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(total * 100), // paise
      currency: settings.commerce.currencyCode || "INR",
      receipt: order._id.toString(),
    });

    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    return NextResponse.json({
      orderId: order._id,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      walletApplied: walletUsed,
      prefill: {
        name: shippingAddress.fullName,
        email: user?.email ?? guestEmail ?? "",
        contact: shippingAddress.phone,
      },
    });
  } catch (err: any) {
    console.error("Razorpay create-order error:", err);

    // Razorpay's SDK throws an object shaped like { statusCode, error: { description } }
    // on auth failures — surface that instead of a generic message so it's obvious
    // this is a credentials problem, not a bug.
    if (err?.statusCode === 401) {
      return NextResponse.json(
        {
          error:
            "Payment gateway authentication failed — check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env.local, and restart the dev server after editing them.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
