import Link from "next/link";
import { connectDB } from "@/lib/db";
import { ContactMessage, Order, Product, ReturnRequest, User } from "@/models";
import { getSiteSettings, formatPrice } from "@/lib/site-settings";
import { getLowStockLines } from "@/lib/inventory";
import { AdminPageHeader, Card, StatTile, TableWrap, Th, Td, Pill, EmptyState } from "@/components/admin/AdminPage";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dashboard" };

/**
 * Admin dashboard — the morning view.
 *
 * Ordered by what needs a decision, not by what is easiest to compute: the
 * action queue comes first, then today's trading, then the things that will
 * become problems (low stock), then recent orders.
 */
export default async function AdminDashboard() {
  await connectDB();
  const settings = await getSiteSettings();
  const symbol = settings.commerce.currencySymbol;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now.getTime() - 7 * 864e5);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const notCancelled = { orderStatus: { $ne: "cancelled" } };

  const [day, week, month, recentOrders, pendingReturns, awaitingDispatch, lowStock, newEnquiries, customerCount, productCount] =
    await Promise.all([
      Order.aggregate([
        { $match: { ...notCancelled, createdAt: { $gte: startOfDay } } },
        { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: "$total" } } },
      ]),
      Order.aggregate([
        { $match: { ...notCancelled, createdAt: { $gte: startOfWeek } } },
        { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: "$total" } } },
      ]),
      Order.aggregate([
        { $match: { ...notCancelled, createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: "$total" } } },
      ]),
      Order.find({}).sort({ createdAt: -1 }).limit(8).lean(),
      ReturnRequest.countDocuments({ status: { $in: ["requested", "received"] } }),
      Order.countDocuments({
        orderStatus: { $in: ["placed", "confirmed", "processing"] },
        $or: [{ paymentStatus: "paid" }, { paymentMethod: "cod" }],
      }),
      getLowStockLines(8),
      ContactMessage.countDocuments({ status: "new" }),
      User.countDocuments({ role: "customer" }),
      Product.countDocuments({ isActive: true }),
    ]);

  const d = day[0] ?? { orders: 0, revenue: 0 };
  const w = week[0] ?? { orders: 0, revenue: 0 };
  const m = month[0] ?? { orders: 0, revenue: 0 };
  const outOfStock = lowStock.filter((l) => l.stock <= 0).length;

  const actions = [
    awaitingDispatch > 0 && {
      href: "/admin/shipping",
      label: `${awaitingDispatch} order${awaitingDispatch === 1 ? "" : "s"} to dispatch`,
      tone: "warning" as const,
    },
    pendingReturns > 0 && {
      href: "/admin/returns",
      label: `${pendingReturns} return${pendingReturns === 1 ? "" : "s"} to action`,
      tone: "warning" as const,
    },
    outOfStock > 0 && {
      href: "/admin/inventory",
      label: `${outOfStock} line${outOfStock === 1 ? "" : "s"} out of stock`,
      tone: "error" as const,
    },
    newEnquiries > 0 && {
      href: "/admin/marketing?tab=enquiries",
      label: `${newEnquiries} unanswered enquir${newEnquiries === 1 ? "y" : "ies"}`,
      tone: "info" as const,
    },
  ].filter(Boolean) as { href: string; label: string; tone: "warning" | "error" | "info" }[];

  return (
    <>
      <AdminPageHeader
        title={`Good ${greeting(now)}`}
        description={`${settings.brand.storeName} · ${now.toLocaleDateString("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}`}
      />

      {/* Action queue first — this is what the shop actually has to do today. */}
      {actions.length > 0 && (
        <Card className="mb-6">
          <p className="eyebrow mb-3">Needs your attention</p>
          <div className="flex flex-wrap gap-2.5">
            {actions.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="rounded-lg border border-line px-4 py-2.5 text-sm text-heading transition-colors hover:border-primary"
              >
                <Pill tone={a.tone}>{a.label}</Pill>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Today"
          value={formatPrice(d.revenue, symbol)}
          hint={`${d.orders} order${d.orders === 1 ? "" : "s"}`}
        />
        <StatTile
          label="Last 7 days"
          value={formatPrice(w.revenue, symbol)}
          hint={`${w.orders} orders`}
        />
        <StatTile
          label="This month"
          value={formatPrice(m.revenue, symbol)}
          hint={`${m.orders} orders`}
        />
        <StatTile
          label="Catalogue"
          value={productCount}
          hint={`${customerCount} registered customers`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-base font-medium text-heading">Recent orders</h2>
          {recentOrders.length === 0 ? (
            <EmptyState message="No orders yet. Once the store is live they will appear here." />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Order</Th>
                  <Th>Customer</Th>
                  <Th>Total</Th>
                  <Th>Payment</Th>
                  <Th>Status</Th>
                  <Th>Placed</Th>
                </tr>
              </thead>
              <tbody>
                {(recentOrders as any[]).map((o) => (
                  <tr key={String(o._id)} className="hover:bg-surface-alt">
                    <Td className="font-medium">{o.orderNumber}</Td>
                    <Td className="text-xs">{o.shippingAddress?.fullName ?? "—"}</Td>
                    <Td className="tabular-nums">{formatPrice(o.total, symbol)}</Td>
                    <Td>
                      <Pill tone={o.paymentStatus === "paid" ? "success" : "default"}>
                        {o.paymentMethod === "cod" ? "COD" : "Prepaid"}
                      </Pill>
                    </Td>
                    <Td>
                      <Pill
                        tone={
                          o.orderStatus === "delivered"
                            ? "success"
                            : o.orderStatus === "cancelled"
                              ? "error"
                              : "default"
                        }
                      >
                        {o.orderStatus.replace(/_/g, " ")}
                      </Pill>
                    </Td>
                    <Td className="text-xs text-muted">
                      {new Date(o.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
          <Link
            href="/admin/orders"
            className="mt-3 inline-block text-sm text-link hover:underline"
          >
            View all orders →
          </Link>
        </div>

        <div>
          <h2 className="mb-3 text-base font-medium text-heading">Low stock</h2>
          <Card padded={false}>
            {lowStock.length === 0 ? (
              <p className="p-6 text-sm text-muted">Everything is comfortably in stock.</p>
            ) : (
              <ul className="divide-y divide-line">
                {lowStock.map((line) => (
                  <li
                    key={`${line.productId}-${line.variantKey}`}
                    className="flex items-center justify-between gap-3 p-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-heading">{line.title}</p>
                      <p className="text-xs text-muted">{line.variantKey || "No variants"}</p>
                    </div>
                    <Pill tone={line.stock <= 0 ? "error" : "warning"}>{line.stock}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Link
            href="/admin/inventory"
            className="mt-3 inline-block text-sm text-link hover:underline"
          >
            Manage inventory →
          </Link>
        </div>
      </div>
    </>
  );
}

function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
