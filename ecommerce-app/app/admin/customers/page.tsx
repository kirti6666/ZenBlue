import Link from "next/link";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { getSiteSettings, formatPrice } from "@/lib/site-settings";
import { AdminPageHeader, TableWrap, Th, Td, EmptyState, Pill, StatTile } from "@/components/admin/AdminPage";
import { CustomerSearch } from "@/components/admin/CustomerSearch";

export const dynamic = "force-dynamic";

export const metadata = { title: "Customers" };

const PAGE_SIZE = 50;

/**
 * Customer list with lifetime value.
 *
 * The rollup is computed by MongoDB in one aggregation rather than by loading
 * every order into Node — on a store with a few thousand customers the
 * difference between those two approaches is the difference between a page
 * that loads and one that times out.
 */
export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: { search?: string; page?: string };
}) {
  await connectDB();
  const settings = await getSiteSettings();
  const symbol = settings.commerce.currencySymbol;

  const search = (searchParams.search ?? "").trim();
  const page = Math.max(1, Number(searchParams.page ?? 1));

  const match: Record<string, unknown> = { role: "customer" };
  if (search) {
    const safe = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    match.$or = [
      { name: { $regex: safe, $options: "i" } },
      { email: { $regex: safe, $options: "i" } },
      { phone: { $regex: safe, $options: "i" } },
    ];
  }

  const [customers, total, totals] = await Promise.all([
    User.aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } },
      { $skip: (page - 1) * PAGE_SIZE },
      { $limit: PAGE_SIZE },
      {
        $lookup: {
          from: "orders",
          localField: "_id",
          foreignField: "user",
          as: "orders",
          pipeline: [
            { $match: { orderStatus: { $ne: "cancelled" } } },
            { $project: { total: 1, createdAt: 1 } },
          ],
        },
      },
      {
        $project: {
          name: 1,
          email: 1,
          phone: 1,
          createdAt: 1,
          isBlocked: 1,
          marketingOptIn: 1,
          orderCount: { $size: "$orders" },
          lifetimeValue: { $sum: "$orders.total" },
          lastOrderAt: { $max: "$orders.createdAt" },
        },
      },
    ]),
    User.countDocuments(match),
    User.aggregate([
      { $match: { role: "customer" } },
      {
        $lookup: {
          from: "orders",
          localField: "_id",
          foreignField: "user",
          as: "orders",
          pipeline: [{ $match: { orderStatus: { $ne: "cancelled" } } }, { $project: { total: 1 } }],
        },
      },
      {
        $group: {
          _id: null,
          customers: { $sum: 1 },
          revenue: { $sum: { $sum: "$orders.total" } },
          buyers: { $sum: { $cond: [{ $gt: [{ $size: "$orders" }, 0] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const roll = totals[0] ?? { customers: 0, revenue: 0, buyers: 0 };
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const avgOrderValue = roll.buyers > 0 ? roll.revenue / roll.buyers : 0;

  return (
    <>
      <AdminPageHeader
        title="Customers"
        description="Everyone who has registered, with their order history and lifetime value."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Registered" value={roll.customers} />
        <StatTile
          label="Have ordered"
          value={roll.buyers}
          hint={
            roll.customers > 0
              ? `${Math.round((roll.buyers / roll.customers) * 100)}% conversion`
              : undefined
          }
        />
        <StatTile
          label="Average per buyer"
          value={formatPrice(avgOrderValue, symbol)}
          hint="Lifetime, excluding cancelled"
        />
      </div>

      <div className="mb-4">
        <CustomerSearch initial={search} />
      </div>

      {customers.length === 0 ? (
        <EmptyState message={search ? `No customers match “${search}”.` : "No customers yet."} />
      ) : (
        <>
          <TableWrap>
            <thead>
              <tr>
                <Th>Customer</Th>
                <Th>Phone</Th>
                <Th>Orders</Th>
                <Th>Lifetime value</Th>
                <Th>Last order</Th>
                <Th>Joined</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {(customers as any[]).map((c) => (
                <tr key={String(c._id)} className="hover:bg-surface-alt">
                  <Td>
                    <span className="block font-medium">{c.name}</span>
                    <span className="block text-xs text-muted">{c.email}</span>
                  </Td>
                  <Td className="text-xs text-muted">{c.phone || "—"}</Td>
                  <Td className="tabular-nums">{c.orderCount}</Td>
                  <Td className="tabular-nums">{formatPrice(c.lifetimeValue ?? 0, symbol)}</Td>
                  <Td className="text-xs text-muted">
                    {c.lastOrderAt
                      ? new Date(c.lastOrderAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </Td>
                  <Td className="text-xs text-muted">
                    {new Date(c.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </Td>
                  <Td>
                    {c.isBlocked ? (
                      <Pill tone="error">Blocked</Pill>
                    ) : c.orderCount > 1 ? (
                      <Pill tone="success">Repeat</Pill>
                    ) : (
                      <Pill>Active</Pill>
                    )}
                  </Td>
                  <Td>
                    <Link
                      href={`/admin/customers/${c._id}`}
                      className="text-sm text-link hover:underline"
                    >
                      Open
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>

          {pages > 1 && (
            <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-3">
              {page > 1 && (
                <Link
                  href={`/admin/customers?page=${page - 1}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
                  className="rounded-lg border border-line px-4 py-2 text-sm text-heading hover:border-primary"
                >
                  Previous
                </Link>
              )}
              <span className="text-sm text-muted">
                Page {page} of {pages}
              </span>
              {page < pages && (
                <Link
                  href={`/admin/customers?page=${page + 1}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
                  className="rounded-lg border border-line px-4 py-2 text-sm text-heading hover:border-primary"
                >
                  Next
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </>
  );
}
