import Link from "next/link";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Address, Order, ReturnRequest, User } from "@/models";
import { getSiteSettings, formatPrice } from "@/lib/site-settings";
import { getWalletBalance, getWalletLedger } from "@/lib/wallet";
import { AdminPageHeader, Card, StatTile, TableWrap, Th, Td, Pill } from "@/components/admin/AdminPage";
import { CustomerActions } from "@/components/admin/CustomerActions";
import { RETURN_STATUS_LABELS } from "@/lib/returns";

export const dynamic = "force-dynamic";

export const metadata = { title: "Customer" };

/** One customer: orders, returns, addresses, store credit and admin controls. */
export default async function AdminCustomerDetail({ params }: { params: { id: string } }) {
  await connectDB();

  const [customer, orders, returns, addresses, walletBalance, ledger, settings] = await Promise.all([
    User.findById(params.id).select("-password").lean<any>(),
    Order.find({ user: params.id }).sort({ createdAt: -1 }).limit(50).lean(),
    ReturnRequest.find({ user: params.id }).sort({ createdAt: -1 }).limit(20).lean(),
    Address.find({ user: params.id }).lean(),
    getWalletBalance(params.id),
    getWalletLedger(params.id, 20),
    getSiteSettings(),
  ]);

  if (!customer) notFound();

  const symbol = settings.commerce.currencySymbol;
  const live = (orders as any[]).filter((o) => o.orderStatus !== "cancelled");
  const lifetimeValue = live.reduce((sum, o) => sum + o.total, 0);

  return (
    <>
      <AdminPageHeader
        title={customer.name}
        description={`${customer.email}${customer.phone ? ` · ${customer.phone}` : ""} · joined ${new Date(
          customer.createdAt
        ).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`}
        actions={
          <Link
            href="/admin/customers"
            className="rounded-lg border border-line px-4 py-2 text-sm text-heading hover:border-primary"
          >
            Back to customers
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Orders placed" value={live.length} />
        <StatTile label="Lifetime value" value={formatPrice(lifetimeValue, symbol)} />
        <StatTile
          label="Returns raised"
          value={returns.length}
          tone={returns.length > 2 ? "warning" : "default"}
          hint={
            live.length > 0
              ? `${Math.round((returns.length / live.length) * 100)}% of orders`
              : undefined
          }
        />
        <StatTile
          label="Store credit"
          value={formatPrice(walletBalance, symbol)}
          tone={walletBalance > 0 ? "success" : "default"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div>
            <h2 className="mb-3 text-base font-medium text-heading">Order history</h2>
            {orders.length === 0 ? (
              <Card>
                <p className="text-sm text-muted">This customer has not ordered yet.</p>
              </Card>
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Order</Th>
                    <Th>Placed</Th>
                    <Th>Items</Th>
                    <Th>Total</Th>
                    <Th>Payment</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {(orders as any[]).map((o) => (
                    <tr key={String(o._id)} className="hover:bg-surface-alt">
                      <Td className="font-medium">{o.orderNumber}</Td>
                      <Td className="text-xs text-muted">
                        {new Date(o.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </Td>
                      <Td className="tabular-nums">
                        {o.items.reduce((s: number, i: any) => s + i.quantity, 0)}
                      </Td>
                      <Td className="tabular-nums">{formatPrice(o.total, symbol)}</Td>
                      <Td className="text-xs">
                        {o.paymentMethod?.toUpperCase()} ·{" "}
                        <span className={o.paymentStatus === "paid" ? "text-success" : "text-muted"}>
                          {o.paymentStatus}
                        </span>
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
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </div>

          {returns.length > 0 && (
            <div>
              <h2 className="mb-3 text-base font-medium text-heading">Returns</h2>
              <TableWrap>
                <thead>
                  <tr>
                    <Th>RMA</Th>
                    <Th>Type</Th>
                    <Th>Refund</Th>
                    <Th>Status</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {(returns as any[]).map((r) => (
                    <tr key={String(r._id)} className="hover:bg-surface-alt">
                      <Td className="font-medium">{r.rmaNumber}</Td>
                      <Td className="text-xs">{r.type}</Td>
                      <Td className="tabular-nums">{formatPrice(r.refundAmount ?? 0, symbol)}</Td>
                      <Td className="text-xs">{RETURN_STATUS_LABELS[r.status] ?? r.status}</Td>
                      <Td>
                        <Link
                          href={`/admin/returns/${r._id}`}
                          className="text-sm text-link hover:underline"
                        >
                          Open
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </div>
          )}

          {ledger.length > 0 && (
            <div>
              <h2 className="mb-3 text-base font-medium text-heading">Store credit ledger</h2>
              <Card padded={false}>
                <ul className="divide-y divide-line">
                  {(ledger as any[]).map((entry) => (
                    <li key={String(entry._id)} className="flex justify-between gap-4 p-4 text-sm">
                      <div>
                        <p className="text-heading">{entry.reason.replace(/_/g, " ")}</p>
                        <p className="text-xs text-muted">
                          {new Date(entry.createdAt).toLocaleDateString("en-IN")}
                          {entry.note ? ` · ${entry.note}` : ""}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 tabular-nums ${
                          entry.amount > 0 ? "text-success" : "text-heading"
                        }`}
                      >
                        {entry.amount > 0 ? "+" : "−"}
                        {formatPrice(Math.abs(entry.amount), symbol)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <CustomerActions
            customerId={params.id}
            isBlocked={!!customer.isBlocked}
            marketingOptIn={!!customer.marketingOptIn}
            currencySymbol={symbol}
          />

          <Card>
            <p className="eyebrow mb-3">Saved addresses</p>
            {addresses.length === 0 ? (
              <p className="text-sm text-muted">None saved.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {(addresses as any[]).map((a) => (
                  <li key={String(a._id)} className="border-b border-line pb-3 last:border-0 last:pb-0">
                    <p className="font-medium text-heading">{a.fullName}</p>
                    <p className="text-xs text-muted">
                      {[a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(", ")}
                    </p>
                    <p className="text-xs text-muted">{a.phone}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
