import Link from "next/link";
import { connectDB } from "@/lib/db";
import { WalletTransaction } from "@/models";
import { getSiteSettings, formatPrice } from "@/lib/site-settings";
import { AdminPageHeader, TableWrap, Th, Td, EmptyState, StatTile, Pill } from "@/components/admin/AdminPage";

export const dynamic = "force-dynamic";

export const metadata = { title: "Store credit" };

const REASON_LABELS: Record<string, string> = {
  return_refund: "Refund for a return",
  order_cancellation: "Order cancelled",
  goodwill: "Goodwill credit",
  promotion: "Promotional credit",
  manual_adjustment: "Manual adjustment",
  order_redemption: "Used on an order",
  redemption_reversal: "Credit returned",
  expiry: "Expired",
};

/**
 * Store-credit overview across all customers.
 *
 * The outstanding balance is a real liability — credit already promised but not
 * yet spent — so it is surfaced as a headline figure rather than buried in
 * per-customer views.
 */
export default async function AdminWalletPage() {
  await connectDB();
  const settings = await getSiteSettings();
  const symbol = settings.commerce.currencySymbol;

  const [transactions, totals, topHolders] = await Promise.all([
    WalletTransaction.find({})
      .populate("user", "name email")
      .populate("order", "orderNumber")
      .sort({ createdAt: -1 })
      .limit(150)
      .lean(),
    WalletTransaction.aggregate([
      {
        $group: {
          _id: null,
          outstanding: { $sum: "$amount" },
          issued: { $sum: { $cond: [{ $gt: ["$amount", 0] }, "$amount", 0] } },
          redeemed: { $sum: { $cond: [{ $lt: ["$amount", 0] }, { $abs: "$amount" }, 0] } },
        },
      },
    ]),
    WalletTransaction.aggregate([
      { $group: { _id: "$user", balance: { $sum: "$amount" } } },
      { $match: { balance: { $gt: 0 } } },
      { $sort: { balance: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
          pipeline: [{ $project: { name: 1, email: 1 } }],
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    ]),
  ]);

  const roll = totals[0] ?? { outstanding: 0, issued: 0, redeemed: 0 };

  return (
    <>
      <AdminPageHeader
        title="Store credit"
        description="Every credit issued and redeemed across the store. Adjust an individual balance from that customer's page."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Outstanding liability"
          value={formatPrice(roll.outstanding, symbol)}
          tone={roll.outstanding > 0 ? "warning" : "default"}
          hint="Issued but not yet spent"
        />
        <StatTile label="Total issued" value={formatPrice(roll.issued, symbol)} />
        <StatTile
          label="Total redeemed"
          value={formatPrice(roll.redeemed, symbol)}
          tone="success"
        />
      </div>

      {topHolders.length > 0 && (
        <>
          <h2 className="mb-3 text-base font-medium text-heading">Largest balances</h2>
          <TableWrap>
            <thead>
              <tr>
                <Th>Customer</Th>
                <Th>Balance</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {(topHolders as any[]).map((h) => (
                <tr key={String(h._id)} className="hover:bg-surface-alt">
                  <Td>
                    <span className="block">{h.user?.name ?? "Unknown"}</span>
                    <span className="block text-xs text-muted">{h.user?.email}</span>
                  </Td>
                  <Td className="tabular-nums">{formatPrice(h.balance, symbol)}</Td>
                  <Td>
                    <Link
                      href={`/admin/customers/${h._id}`}
                      className="text-sm text-link hover:underline"
                    >
                      Open
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </>
      )}

      <h2 className="mb-3 mt-10 text-base font-medium text-heading">Recent transactions</h2>
      {transactions.length === 0 ? (
        <EmptyState message="No store credit has been issued yet." />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Customer</Th>
              <Th>Reason</Th>
              <Th>Order</Th>
              <Th>Amount</Th>
              <Th>Balance after</Th>
            </tr>
          </thead>
          <tbody>
            {(transactions as any[]).map((t) => (
              <tr key={String(t._id)} className="hover:bg-surface-alt">
                <Td className="whitespace-nowrap text-xs text-muted">
                  {new Date(t.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </Td>
                <Td className="text-xs">{t.user?.name ?? "—"}</Td>
                <Td className="text-xs">
                  {REASON_LABELS[t.reason] ?? t.reason}
                  {t.note ? ` — ${t.note}` : ""}
                </Td>
                <Td className="text-xs text-muted">{t.order?.orderNumber ?? "—"}</Td>
                <Td>
                  <Pill tone={t.amount > 0 ? "success" : "default"}>
                    {t.amount > 0 ? "+" : "−"}
                    {formatPrice(Math.abs(t.amount), symbol)}
                  </Pill>
                </Td>
                <Td className="tabular-nums">{formatPrice(t.balanceAfter, symbol)}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
