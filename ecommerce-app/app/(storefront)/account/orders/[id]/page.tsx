import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Download } from "lucide-react";
import { connectDB } from "@/lib/db";
import { Order } from "@/models";
import { getServerUser } from "@/lib/middleware/getServerUser";
import { getSiteSettings } from "@/lib/site-settings";
import { checkReturnEligibility } from "@/lib/returns";
import { OrderActions } from "@/components/storefront/OrderActions";
import { ReturnRequest } from "@/models";

export const dynamic = "force-dynamic";

// "confirmed" and "out_for_delivery" collapse into the neighbouring steps so
// the customer sees a four-stage tracker rather than a seven-stage one.
const STEPS = ["placed", "processing", "shipped", "delivered"];

function trackerStatus(status: string): string {
  if (status === "confirmed") return "processing";
  if (status === "out_for_delivery") return "shipped";
  return status;
}

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const user = await getServerUser();
  if (!user) redirect("/login");

  await connectDB();
  const [order, settings] = await Promise.all([
    Order.findById(params.id).lean<any>(),
    getSiteSettings(),
  ]);

  if (!order) notFound();
  const o = order as any;
  const isOwner = o.user?.toString() === user.id;
  const isStaff = user.role === "admin" || user.role === "staff";
  if (!isOwner && !isStaff) notFound();

  const isCancelled = o.orderStatus === "cancelled";
  const currentStepIndex = STEPS.indexOf(trackerStatus(o.orderStatus));

  // Whether a return can be raised, computed with the same rules the API
  // enforces, so the button never appears when the request would be refused.
  const existingReturns = await ReturnRequest.find({ order: params.id }).lean();
  const eligibility = checkReturnEligibility(o, settings, existingReturns);
  const canCancel = ["placed", "confirmed", "processing"].includes(o.orderStatus);

  return (
    <main className="mx-auto max-w-2xl px-5 py-8 sm:px-6 sm:py-10">
      <Link href="/account/orders" className="text-sm text-primary underline">
        ← Back to orders
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3 mt-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Order Details</h1>
          <p className="text-gray-400 text-sm font-mono">
            {o.orderNumber ?? `#${String(o._id).slice(-8)}`}
          </p>
        </div>
        {/* Issues the tax invoice on first open, then always serves the same
            numbered document. Opens in a new tab so the order page is kept. */}
        <a
          href={`/api/invoices/${String(o._id)}?download=1`}
          className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
        >
          <Download size={15} /> Download Invoice
        </a>
      </div>

      {o.awb && (
        <div className="mb-6 rounded-md border p-4 text-sm">
          <p className="font-medium">
            {o.courierName || "Courier"} · AWB {o.awb}
          </p>
          {o.trackingUrl && (
            <a
              href={o.trackingUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-link underline underline-offset-4"
            >
              Track your parcel →
            </a>
          )}
        </div>
      )}

      <OrderActions
        orderId={String(o._id)}
        orderNumber={o.orderNumber ?? String(o._id).slice(-6).toUpperCase()}
        canCancel={canCancel && isOwner}
        canReturn={eligibility.eligible && isOwner}
        returnBlockedReason={eligibility.reason}
        returnWindowClosesAt={eligibility.windowClosesAt?.toISOString()}
        policySummary={settings.returns.policySummary}
      />

      {isCancelled ? (
        <div className="bg-red-50 text-red-700 rounded-md p-3 text-sm mb-6">
          This order was cancelled.
        </div>
      ) : (
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((step, i) => (
            <div key={step} className="flex-1 flex flex-col items-center text-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                  i <= currentStepIndex
                    ? "bg-primary text-primary-foreground"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {i + 1}
              </div>
              <span className="text-xs mt-1 capitalize text-gray-500">{step}</span>
              {i < STEPS.length - 1 && (
                <div
                  className={`h-0.5 w-full mt-4 -translate-y-4 ${
                    i < currentStepIndex ? "bg-primary" : "bg-gray-200"
                  }`}
                  style={{ marginLeft: "50%" }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="border rounded-md p-6 space-y-4">
        <div>
          <h2 className="font-medium mb-2">Items</h2>
          {o.items.map((item: any, i: number) => (
            <div key={i} className="flex justify-between text-sm py-1">
              <span>
                {item.title} × {item.quantity}
                {item.variant && Object.keys(item.variant).length > 0 && (
                  <span className="text-gray-400">
                    {" "}
                    ({Object.entries(item.variant)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(", ")})
                  </span>
                )}
              </span>
              <span>₹{item.price * item.quantity}</span>
            </div>
          ))}
        </div>

        <div className="border-t pt-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>₹{o.subtotal}</span>
          </div>
          {o.discount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount {o.couponCode ? `(${o.couponCode})` : ""}</span>
              <span>−₹{o.discount}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Shipping</span>
            <span>{o.shippingFee === 0 ? "Free" : `₹${o.shippingFee}`}</span>
          </div>
          <div className="flex justify-between font-bold border-t pt-1 mt-1">
            <span>Total</span>
            <span>₹{o.total}</span>
          </div>
        </div>

        <div className="border-t pt-3 text-sm">
          <h2 className="font-medium mb-1">Shipping to</h2>
          <p className="text-gray-500">
            {o.shippingAddress.fullName}, {o.shippingAddress.line1}
            {o.shippingAddress.line2 ? `, ${o.shippingAddress.line2}` : ""},{" "}
            {o.shippingAddress.city}, {o.shippingAddress.state} - {o.shippingAddress.pincode}
          </p>
        </div>

        <div className="border-t pt-3 text-sm">
          <span className="inline-block px-2 py-1 rounded-full bg-gray-100 text-gray-600 text-xs">
            {o.paymentMethod === "razorpay" ? "Paid Online (Razorpay)" : "Cash on Delivery"}
          </span>
          <span className="inline-block px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs ml-2">
            {o.paymentStatus === "paid" ? "Payment Confirmed" : `Payment ${o.paymentStatus}`}
          </span>
        </div>
      </div>
    </main>
  );
}
