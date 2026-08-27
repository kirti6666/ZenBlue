import Link from "next/link";
import { connectDB } from "@/lib/db";
import { AbandonedCart, ContactMessage, Subscriber } from "@/models";
import { getSiteSettings, formatPrice } from "@/lib/site-settings";
import { AdminPageHeader, TableWrap, Th, Td, EmptyState, Pill, StatTile, Card } from "@/components/admin/AdminPage";

export const dynamic = "force-dynamic";

export const metadata = { title: "Marketing" };

/**
 * Marketing desk: abandoned-cart recovery, newsletter list and contact
 * enquiries in one place — the three things that generate follow-up work.
 */
export default async function AdminMarketingPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  await connectDB();
  const tab = searchParams.tab ?? "carts";

  const [carts, cartStats, subscriberCount, enquiries, settings] = await Promise.all([
    AbandonedCart.find({ status: { $in: ["abandoned", "active", "recovered"] }, itemCount: { $gt: 0 } })
      .sort({ lastActivityAt: -1 })
      .limit(100)
      .lean(),
    AbandonedCart.aggregate([
      {
        $group: {
          _id: null,
          open: {
            $sum: { $cond: [{ $in: ["$status", ["active", "abandoned"]] }, 1, 0] },
          },
          openValue: {
            $sum: {
              $cond: [{ $in: ["$status", ["active", "abandoned"]] }, "$subtotal", 0],
            },
          },
          recovered: { $sum: { $cond: [{ $eq: ["$status", "recovered"] }, 1, 0] } },
          recoveredValue: { $sum: "$recoveredRevenue" },
        },
      },
    ]),
    Subscriber.countDocuments({ status: "subscribed" }),
    ContactMessage.find({}).sort({ createdAt: -1 }).limit(50).lean(),
    getSiteSettings(),
  ]);

  const stats = cartStats[0] ?? { open: 0, openValue: 0, recovered: 0, recoveredValue: 0 };
  const symbol = settings.commerce.currencySymbol;
  const newEnquiries = (enquiries as any[]).filter((e) => e.status === "new").length;

  const TABS = [
    { key: "carts", label: `Abandoned carts (${stats.open})` },
    { key: "subscribers", label: `Newsletter (${subscriberCount})` },
    { key: "enquiries", label: `Enquiries (${newEnquiries})` },
  ];

  return (
    <>
      <AdminPageHeader
        title="Marketing"
        description="Abandoned-cart recovery, your newsletter list, and enquiries from the contact form."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Open carts"
          value={stats.open}
          tone={stats.open > 0 ? "warning" : "default"}
          hint={formatPrice(stats.openValue, symbol) + " at stake"}
        />
        <StatTile
          label="Recovered"
          value={stats.recovered}
          tone="success"
          hint={formatPrice(stats.recoveredValue, symbol) + " won back"}
        />
        <StatTile label="Subscribers" value={subscriberCount} />
        <StatTile
          label="New enquiries"
          value={newEnquiries}
          tone={newEnquiries > 0 ? "warning" : "default"}
        />
      </div>

      {!settings.abandonedCart.enabled && (
        <Card className="mb-6 border-warning/40">
          <p className="text-sm text-heading">
            Abandoned-cart recovery is switched off. Turn it on under{" "}
            <Link href="/admin/settings" className="text-link underline">
              Settings → Abandoned cart
            </Link>
            .
          </p>
        </Card>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/marketing?tab=${t.key}`}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-primary text-primary-foreground"
                : "border border-line text-body hover:border-primary"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "carts" &&
        (carts.length === 0 ? (
          <EmptyState message="No carts have been abandoned yet." />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Shopper</Th>
                <Th>Items</Th>
                <Th>Value</Th>
                <Th>Last active</Th>
                <Th>Nudges sent</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {(carts as any[]).map((c) => (
                <tr key={String(c._id)} className="hover:bg-surface-alt">
                  <Td>
                    <span className="block text-xs">
                      {c.email || c.phone || "Guest (no contact captured)"}
                    </span>
                    <span className="block text-xs text-muted">
                      {c.user ? "Registered" : "Guest"}
                    </span>
                  </Td>
                  <Td className="tabular-nums">{c.itemCount}</Td>
                  <Td className="tabular-nums">{formatPrice(c.subtotal, symbol)}</Td>
                  <Td className="text-xs text-muted">
                    {new Date(c.lastActivityAt).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Td>
                  <Td className="tabular-nums">{(c.stepsSent ?? []).length}</Td>
                  <Td>
                    <Pill
                      tone={
                        c.status === "recovered"
                          ? "success"
                          : c.status === "abandoned"
                            ? "warning"
                            : "default"
                      }
                    >
                      {c.status}
                    </Pill>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ))}

      {tab === "subscribers" && (
        <Card>
          <p className="text-sm text-heading">
            {subscriberCount} active subscriber{subscriberCount === 1 ? "" : "s"}.
          </p>
          <p className="mt-1 text-sm text-muted">
            Export the list as CSV from{" "}
            <Link href="/admin/reports" className="text-link underline">
              Reports &amp; exports
            </Link>{" "}
            to load into your email platform.
          </p>
        </Card>
      )}

      {tab === "enquiries" &&
        (enquiries.length === 0 ? (
          <EmptyState message="No enquiries from the contact form yet." />
        ) : (
          <div className="space-y-3">
            {(enquiries as any[]).map((e) => (
              <Card key={String(e._id)}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-heading">
                      {e.subject || "No subject"}
                      {e.type === "bulk" && <Pill tone="info">Bulk order</Pill>}
                      {e.type === "custom" && <Pill tone="info">Customisation</Pill>}
                      {e.status === "new" && <Pill tone="warning">New</Pill>}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {e.name} · {e.email}
                      {e.phone ? ` · ${e.phone}` : ""} ·{" "}
                      {new Date(e.createdAt).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <a
                    href={`mailto:${e.email}?subject=Re: ${encodeURIComponent(e.subject || "Your enquiry")}`}
                    className="shrink-0 rounded-lg border border-line px-3.5 py-2 text-sm text-heading hover:border-primary"
                  >
                    Reply
                  </a>
                </div>
                {(e.type === "bulk" || e.type === "custom") && (
                  <dl className="mt-3 grid gap-x-6 gap-y-1.5 border-t border-line pt-3 text-sm sm:grid-cols-2">
                    {[
                      ["Company", e.company],
                      ["Looking for", e.productInterest],
                      ["Quantity", e.quantity],
                      ["Budget", e.budget],
                      ["Needed by", e.needByDate],
                      ["Customisation", e.customisation],
                    ]
                      .filter(([, v]) => !!v)
                      .map(([k, v]) => (
                        <div key={k as string} className="flex gap-2">
                          <dt className="shrink-0 text-muted">{k}</dt>
                          <dd className="text-body">{v as string}</dd>
                        </div>
                      ))}
                  </dl>
                )}

                {e.message && (
                  <p className="mt-3 whitespace-pre-line border-t border-line pt-3 text-sm text-body">
                    {e.message}
                  </p>
                )}
              </Card>
            ))}
          </div>
        ))}
    </>
  );
}
