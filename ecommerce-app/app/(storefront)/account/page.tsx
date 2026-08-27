import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Heart, MapPin, Package, Wallet } from "lucide-react";
import { connectDB } from "@/lib/db";
import { Address, Order, User } from "@/models";
import { getServerUser } from "@/lib/middleware/getServerUser";
import { getWalletBalance } from "@/lib/wallet";
import { getSiteSettings, formatPrice } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export const metadata = { title: "My Account" };

const STATUS_LABELS: Record<string, string> = {
  placed: "Placed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/**
 * Account overview: the four numbers a returning customer actually opens this
 * page for, then their most recent orders. Everything else is one tap away in
 * the sidebar rather than duplicated here.
 */
export default async function AccountPage() {
  const current = await getServerUser();
  if (!current) redirect("/login?callbackUrl=/account");

  await connectDB();

  const [user, orders, orderCount, addressCount, balance, settings] = await Promise.all([
    User.findById(current.id)
      .select("name firstName wishlist")
      .lean<{ name?: string; firstName?: string; wishlist?: unknown[] } | null>(),
    Order.find({ user: current.id }).sort({ createdAt: -1 }).limit(3).lean(),
    Order.countDocuments({ user: current.id }),
    Address.countDocuments({ user: current.id }),
    getWalletBalance(current.id),
    getSiteSettings(),
  ]);

  const symbol = settings.commerce.currencySymbol;
  const greeting = user?.firstName || user?.name?.split(" ")[0] || "there";

  const tiles = [
    { href: "/account/orders", label: "Orders", value: String(orderCount), icon: Package },
    {
      href: "/account/wallet",
      label: "Store credit",
      value: formatPrice(balance, symbol),
      icon: Wallet,
    },
    {
      href: "/account/wishlist",
      label: "Wishlist",
      value: String(user?.wishlist?.length ?? 0),
      icon: Heart,
    },
    { href: "/account/addresses", label: "Addresses", value: String(addressCount), icon: MapPin },
  ];

  return (
    <main>
      <h1 className="font-display text-2xl font-semibold text-heading">Hi {greeting}</h1>
      <p className="mt-1 text-sm text-body">Here is everything on your account.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(({ href, label, value, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="rounded-xl border border-line bg-surface p-4 transition-colors hover:border-primary"
          >
            <Icon size={17} strokeWidth={1.7} className="text-muted" />
            <p className="mt-3 font-display text-xl text-heading">{value}</p>
            <p className="text-xs text-muted">{label}</p>
          </Link>
        ))}
      </div>

      <section className="mt-9">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg text-heading">Recent orders</h2>
          {orderCount > 0 && (
            <Link
              href="/account/orders"
              className="inline-flex items-center gap-1 text-sm text-link underline-offset-4 hover:underline"
            >
              View all <ArrowRight size={13} />
            </Link>
          )}
        </div>

        {orders.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-line p-10 text-center">
            <p className="text-sm text-body">You have not placed an order yet.</p>
            <Link
              href="/shop"
              className="mt-4 inline-block rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground"
            >
              Start shopping
            </Link>
          </div>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {orders.map((order: any) => (
              <li key={String(order._id)}>
                <Link
                  href={`/account/orders/${order._id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-primary"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-muted">
                      #{String(order._id).slice(-8).toUpperCase()}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {new Date(order.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-heading">
                      {formatPrice(order.total, symbol)}
                    </p>
                    <p className="text-xs text-muted">
                      {STATUS_LABELS[order.orderStatus] ?? order.orderStatus}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
