import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Order } from "@/models";
import { getSiteSettings, formatPrice } from "@/lib/site-settings";
import { AdminPageHeader, Card, StatTile, TableWrap, Th, Td, EmptyState } from "@/components/admin/AdminPage";
import { ExportPanel } from "@/components/admin/ExportPanel";

export const dynamic = "force-dynamic";

export const metadata = { title: "Reports & exports" };

/**
 * Sales reporting and CSV exports.
 *
 * Every figure comes from an aggregation with cancelled orders excluded, so the
 * numbers here match what was actually earned rather than what was attempted.
 */
export default async function AdminReportsPage() {
  await connectDB();
  const settings = await getSiteSettings();
  const symbol = settings.commerce.currencySymbol;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 864e5);

  const paid = { orderStatus: { $ne: "cancelled" } };

  const [today, month, byDay, byCategory, topProducts] = await Promise.all([
    Order.aggregate([
      { $match: { ...paid, createdAt: { $gte: startOfDay } } },
      { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: "$total" } } },
    ]),
    Order.aggregate([
      { $match: { ...paid, createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: "$total" } } },
    ]),
    Order.aggregate([
      { $match: { ...paid, createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          // Grouped in IST rather than UTC — otherwise every order placed after
          // 5:30am IST lands in the wrong day for an Indian shop owner.
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" },
          },
          orders: { $sum: 1 },
          revenue: { $sum: "$total" },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 30 },
    ]),
    Order.aggregate([
      { $match: { ...paid, createdAt: { $gte: thirtyDaysAgo } } },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.product",
          foreignField: "_id",
          as: "product",
          pipeline: [{ $project: { category: 1 } }],
        },
      },
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "categories",
          localField: "product.category",
          foreignField: "_id",
          as: "category",
          pipeline: [{ $project: { name: 1 } }],
        },
      },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ["$category.name", "Uncategorised"] },
          units: { $sum: "$items.quantity" },
          revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
        },
      },
      { $sort: { revenue: -1 } },
    ]),
    Order.aggregate([
      { $match: { ...paid, createdAt: { $gte: thirtyDaysAgo } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.title",
          units: { $sum: "$items.quantity" },
          revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
        },
      },
      { $sort: { units: -1 } },
      { $limit: 10 },
    ]),
  ]);

  const todayRoll = today[0] ?? { orders: 0, revenue: 0 };
  const monthRoll = month[0] ?? { orders: 0, revenue: 0 };
  const thirtyRevenue = byDay.reduce((s: number, d: any) => s + d.revenue, 0);
  const thirtyOrders = byDay.reduce((s: number, d: any) => s + d.orders, 0);
  const peak = Math.max(1, ...byDay.map((d: any) => d.revenue));

  return (
    <>
      <AdminPageHeader
        title="Reports & exports"
        description="Sales performance over the last 30 days, and CSV downloads for your accountant."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Today"
          value={formatPrice(todayRoll.revenue, symbol)}
          hint={`${todayRoll.orders} order${todayRoll.orders === 1 ? "" : "s"}`}
        />
        <StatTile
          label="This month"
          value={formatPrice(monthRoll.revenue, symbol)}
          hint={`${monthRoll.orders} order${monthRoll.orders === 1 ? "" : "s"}`}
        />
        <StatTile
          label="Last 30 days"
          value={formatPrice(thirtyRevenue, symbol)}
          hint={`${thirtyOrders} orders`}
        />
        <StatTile
          label="Average order"
          value={formatPrice(thirtyOrders > 0 ? thirtyRevenue / thirtyOrders : 0, symbol)}
          hint="Last 30 days"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <p className="eyebrow mb-4">Revenue by day</p>
          {byDay.length === 0 ? (
            <p className="text-sm text-muted">No orders in the last 30 days.</p>
          ) : (
            <ul className="space-y-1.5">
              {byDay.map((d: any) => (
                <li key={d._id} className="flex items-center gap-3 text-xs">
                  <span className="w-16 shrink-0 text-muted">
                    {new Date(d._id).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  {/* A plain proportional bar — readable, and no chart library
                      shipped to the browser for one sparkline. */}
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-alt">
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(2, (d.revenue / peak) * 100)}%` }}
                    />
                  </span>
                  <span className="w-20 shrink-0 text-right tabular-nums text-heading">
                    {formatPrice(d.revenue, symbol)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <p className="eyebrow mb-4">Sales by category — last 30 days</p>
            {byCategory.length === 0 ? (
              <p className="text-sm text-muted">No sales yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {byCategory.map((c: any) => (
                  <li key={c._id} className="flex justify-between gap-3 text-sm">
                    <span className="text-heading">{c._id}</span>
                    <span className="shrink-0 text-right">
                      <span className="tabular-nums text-heading">
                        {formatPrice(c.revenue, symbol)}
                      </span>
                      <span className="ml-2 text-xs text-muted">{c.units} units</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <p className="eyebrow mb-4">Top products — last 30 days</p>
            {topProducts.length === 0 ? (
              <p className="text-sm text-muted">No sales yet.</p>
            ) : (
              <ol className="space-y-2.5">
                {topProducts.map((p: any, i: number) => (
                  <li key={p._id} className="flex justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-heading">
                      <span className="mr-2 text-muted tabular-nums">{i + 1}</span>
                      {p._id}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted">{p.units} sold</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>

      <h2 className="mb-3 mt-10 text-base font-medium text-heading">Exports</h2>
      <ExportPanel />
    </>
  );
}
