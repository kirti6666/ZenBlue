import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/db";
import { Order } from "@/models";
import { requireAuth } from "@/lib/middleware/requireAuth";
import { confirmRazorpayPayment } from "@/lib/confirmRazorpayPayment";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: "Missing payment details" }, { status: 400 });
    }

    await connectDB();

    const order = await Order.findById(orderId);
    if (!order || order.user.toString() !== user.id) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (order.razorpayOrderId !== razorpay_order_id) {
      return NextResponse.json({ error: "Order mismatch" }, { status: 400 });
    }
    if (order.paymentStatus === "paid") {
      // Already confirmed (e.g. the webhook beat this request) — treat as success.
      return NextResponse.json({ success: true, orderId: order._id });
    }

    // The Razorpay-documented verification formula: HMAC-SHA256 of
    // "razorpay_order_id|razorpay_payment_id", keyed with our secret.
    // NEVER trust the client's claim of success without this check server-side.
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET as string)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature);
    const receivedBuffer = Buffer.from(String(razorpay_signature));

    const signaturesMatch =
      expectedBuffer.length === receivedBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, receivedBuffer);

    if (!signaturesMatch) {
      order.paymentStatus = "failed";
      await order.save();
      return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
    }

    const result = await confirmRazorpayPayment(order._id.toString(), razorpay_payment_id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, orderId: order._id });
  } catch (err) {
    console.error("Razorpay verify error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
