import { redirect } from "next/navigation";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { getServerUser } from "@/lib/middleware/getServerUser";
import { getSiteSettings, formatPrice } from "@/lib/site-settings";
import { getWalletBalance, getWalletLedger } from "@/lib/wallet";
import { PageHeader } from "@/components/storefront/PageHeader";

export const dynamic = "force-dynamic";

export const metadata = { title: "Store Credit" };

const REASON_LABELS: Record<string, string> = {
  return_refund: "Refund for a return",
  order_cancellation: "Order cancelled",
  goodwill: "Goodwill credit",
  promotion: "Promotional credit",
  manual_adjustment: "Adjustment",
  order_redemption: "Used on an order",
  redemption_reversal: "Credit returned",
  expiry: "Expired",
};

/** Customer's store-credit balance and full transaction ledger. */
export default async function WalletPage() {
  const user = await getServerUser();
  if (!user) redirect("/login?callbackUrl=/account/wallet");

  const [balance, ledger, settings] = await Promise.all([
    getWalletBalance(user.id),
    getWalletLedger(user.id),
    getSiteSettings(),
  ]);

  const symbol = settings.commerce.currencySymbol;

  return (
    <main>
      <PageHeader
        title="Store credit"
        subtitle="Applies automatically at checkout. It never expires."
        breadcrumbs={[
          { name: "My Account", path: "/account" },
          { name: "Store Credit", path: "/account/wallet" },
        ]}
      />

      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 rounded-xl border border-line bg-surface p-8 text-center">
          <span className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface-alt text-heading">
            <Wallet size={22} />
          </span>
          <p className="eyebrow">Available balance</p>
          <p className="mt-1 font-display text-4xl font-semibold text-heading">
            {formatPrice(balance, symbol)}
          </p>
          {balance > 0 && (
            <Link
              href="/shop"
              className="mt-5 inline-block rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
            >
              Spend it
            </Link>
          )}
        </div>

        <h2 className="mb-3 text-base font-medium text-heading">Transaction history</h2>
        {ledger.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface p-8 text-center text-sm text-muted">
            No store credit activity yet.
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {(ledger as any[]).map((entry) => (
              <li key={String(entry._id)} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="text-sm text-heading">
                    {REASON_LABELS[entry.reason] ?? entry.reason}
                  </p>
                  <p className="text-xs text-muted">
                    {new Date(entry.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    {entry.order?.orderNumber && ` · ${entry.order.orderNumber}`}
                    {entry.note && ` · ${entry.note}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={`text-sm font-semibold ${
                      entry.amount > 0 ? "text-success" : "text-heading"
                    }`}
                  >
                    {entry.amount > 0 ? "+" : "−"}
                    {formatPrice(Math.abs(entry.amount), symbol)}
                  </p>
                  <p className="text-xs text-muted">
                    Balance {formatPrice(entry.balanceAfter, symbol)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
