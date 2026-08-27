import Link from "next/link";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Order } from "@/models";
import { getServerUser } from "@/lib/middleware/getServerUser";

const STATUS_COLORS: Record<string, string> = {
  placed: "bg-gray-100 text-gray-600",
  processing: "bg-yellow-100 text-yellow-700",
  shipped: "bg-blue-100 text-blue-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export const dynamic = "force-dynamic";

export default async function OrderHistoryPage() {
  const user = await getServerUser();
  if (!user) redirect("/login");

  await connectDB();
  const orders = await Order.find({ user: user.id }).sort({ createdAt: -1 }).lean();

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-bold mb-6">My Orders</h1>

      {orders.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 mb-4">You haven&apos;t placed any orders yet.</p>
          <Link href="/shop" className="text-primary underline">
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link
              key={String(order._id)}
              href={`/account/orders/${order._id}`}
              className="block border rounded-md p-4 text-sm hover:shadow-sm transition"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-gray-400">
                    #{String(order._id).slice(-8)}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    {new Date(order.createdAt as unknown as string).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold">₹{order.total}</p>
                  <span
                    className={`inline-block text-xs px-2 py-1 rounded-full mt-1 ${
                      STATUS_COLORS[order.orderStatus] ?? "bg-gray-100"
                    }`}
                  >
                    {order.orderStatus}
                  </span>
                </div>
              </div>
              <p className="text-gray-500 mt-2">
                {order.items.map((item: any, i: number) => item.title).join(", ")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
