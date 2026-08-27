import Link from "next/link";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { ReturnRequest } from "@/models";
import { getServerUser } from "@/lib/middleware/getServerUser";
import { getSiteSettings, formatPrice } from "@/lib/site-settings";
import { PageHeader } from "@/components/storefront/PageHeader";
import { ReturnStatusBadge } from "@/components/storefront/ReturnStatusBadge";

export const dynamic = "force-dynamic";

export const metadata = { title: "Returns & Exchanges" };

/** Customer's list of return/exchange requests. */
export default async function ReturnsListPage() {
  const user = await getServerUser();
  if (!user) redirect("/login?callbackUrl=/account/returns");

  await connectDB();
  const [requests, settings] = await Promise.all([
    ReturnRequest.find({ user: user.id })
      .populate("order", "orderNumber createdAt")
      .sort({ createdAt: -1 })
      .lean(),
    getSiteSettings(),
  ]);

  const symbol = settings.commerce.currencySymbol;

  return (
    <main>
      <PageHeader
        title="Returns & exchanges"
        subtitle={settings.returns.policySummary}
        breadcrumbs={[
          { name: "My Account", path: "/account" },
          { name: "Returns", path: "/account/returns" },
        ]}
      />

      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-6 sm:py-12">
        {requests.length === 0 ? (
          <div className="rounded-xl border border-line bg-surface p-10 text-center">
            <p className="text-sm text-muted">You have not raised any returns yet.</p>
            <Link
              href="/account/orders"
              className="mt-4 inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
            >
              View your orders
            </Link>
          </div>
        ) : (
          <ul className="space-y-4">
            {(requests as any[]).map((r) => (
              <li key={String(r._id)}>
                <Link
                  href={`/account/returns/${r._id}`}
                  className="block rounded-xl border border-line bg-surface p-5 transition-colors hover:border-primary"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-heading">{r.rmaNumber}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {r.type === "exchange" ? "Exchange" : "Return"} · Order{" "}
                        {r.order?.orderNumber ?? "—"} ·{" "}
                        {new Date(r.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <ReturnStatusBadge status={r.status} />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {r.items.slice(0, 4).map((item: any, i: number) =>
                      item.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={i}
                          src={item.image}
                          alt=""
                          className="h-12 w-12 rounded-md object-cover"
                          loading="lazy"
                        />
                      ) : null
                    )}
                    <span className="text-xs text-muted">
                      {r.items.length} item{r.items.length === 1 ? "" : "s"}
                      {r.refundAmount > 0 && ` · ${formatPrice(r.refundAmount, symbol)}`}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
