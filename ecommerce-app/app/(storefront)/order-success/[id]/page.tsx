import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { connectDB } from "@/lib/db";
import { Order } from "@/models";
import { getServerUser } from "@/lib/middleware/getServerUser";
import { IOrder } from "@/models/Order";

export default async function OrderSuccessPage({ params }: { params: { id: string } }) {
  const user = await getServerUser();
  if (!user) redirect("/login");

  await connectDB();
  const order = await Order.findById(params.id).lean<IOrder>();

  if (!order) notFound();
  const isOwner = (order as { user: unknown }).user?.toString() === user.id;
  if (!isOwner && user.role !== "admin") notFound();

  const o = order as any;

  return (
    <main className="max-w-2xl mx-auto px-6 py-16 text-center">
      <div className="text-5xl mb-4">✓</div>
      <h1 className="text-2xl font-bold mb-2">Order placed successfully!</h1>
      <p className="text-gray-500 mb-8">
        Order ID: <span className="font-mono">{String(o._id)}</span>
      </p>

      <div className="border rounded-md p-6 text-left space-y-4">
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
            Payment: {o.paymentMethod === "razorpay" ? "Paid Online (Razorpay)" : "Cash on Delivery"}
          </span>
          <span className="inline-block px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs ml-2">
            {o.paymentStatus === "paid" ? "Payment Confirmed" : "Payment Pending"}
          </span>
          <span className="inline-block px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs ml-2">
            Status: {o.orderStatus}
          </span>
        </div>
      </div>

      <Link href="/shop" className="inline-block mt-8 text-primary underline">
        Continue shopping
      </Link>
    </main>
  );
}
