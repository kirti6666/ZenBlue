import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { ReturnRequest } from "@/models";
import { getServerUser } from "@/lib/middleware/getServerUser";
import { getSiteSettings, formatPrice } from "@/lib/site-settings";
import { PageHeader } from "@/components/storefront/PageHeader";
import { ReturnStatusBadge } from "@/components/storefront/ReturnStatusBadge";
import { CancelReturnButton } from "@/components/storefront/CancelReturnButton";
import { RETURN_REASON_LABELS, RETURN_STATUS_LABELS, customerCanCancel } from "@/lib/returns";

export const dynamic = "force-dynamic";

export const metadata = { title: "Return details" };

/** One return request: items, timeline, resolution and pickup details. */
export default async function ReturnDetailPage({ params }: { params: { id: string } }) {
  const user = await getServerUser();
  if (!user) redirect(`/login?callbackUrl=/account/returns/${params.id}`);

  await connectDB();
  const [request, settings] = await Promise.all([
    ReturnRequest.findOne({ _id: params.id, user: user.id })
      .populate("order", "orderNumber total createdAt")
      .lean(),
    getSiteSettings(),
  ]);

  if (!request) notFound();
  const r = request as any;
  const symbol = settings.commerce.currencySymbol;

  return (
    <main>
      <PageHeader
        title={r.rmaNumber}
        subtitle={`${r.type === "exchange" ? "Exchange" : "Return"} against order ${
          r.order?.orderNumber ?? ""
        }`}
        breadcrumbs={[
          { name: "My Account", path: "/account" },
          { name: "Returns", path: "/account/returns" },
          { name: r.rmaNumber, path: `/account/returns/${params.id}` },
        ]}
      />

      <div className="mx-auto grid max-w-5xl gap-6 px-5 py-8 sm:gap-8 sm:px-6 sm:py-12 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Items */}
          <section className="rounded-xl border border-line bg-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-medium text-heading">Items</h2>
              <ReturnStatusBadge status={r.status} />
            </div>
            <ul className="divide-y divide-line">
              {r.items.map((item: any, i: number) => (
                <li key={i} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image}
                      alt=""
                      className="h-20 w-16 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div className="h-20 w-16 shrink-0 rounded-md bg-surface-alt" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-heading">{item.title}</p>
                    {item.variantKey && <p className="text-xs text-muted">{item.variantKey}</p>}
                    <p className="mt-1 text-xs text-muted">
                      Qty {item.quantity} · {formatPrice(item.unitPrice, symbol)} each
                    </p>
                    {item.exchangeVariantKey && (
                      <p className="mt-1 text-xs text-link">
                        Exchange for: {item.exchangeVariantKey}
                      </p>
                    )}
                    {item.qcResult !== "pending" && (
                      <p
                        className={`mt-1 text-xs ${
                          item.qcResult === "passed" ? "text-success" : "text-warning"
                        }`}
                      >
                        Quality check {item.qcResult}
                        {item.qcRemarks ? ` — ${item.qcRemarks}` : ""}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Timeline */}
          <section className="rounded-xl border border-line bg-surface p-6">
            <h2 className="mb-4 text-base font-medium text-heading">Progress</h2>
            <ol className="space-y-4">
              {(r.timeline ?? []).map((entry: any, i: number) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p className="text-sm text-heading">
                      {RETURN_STATUS_LABELS[entry.status] ?? entry.status}
                    </p>
                    {entry.note && <p className="text-xs text-muted">{entry.note}</p>}
                    <p className="text-xs text-muted">
                      {new Date(entry.at).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Summary rail */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-line bg-surface p-6">
            <p className="eyebrow mb-3">Summary</p>
            <dl className="space-y-2.5 text-sm">
              <Row label="Reason" value={RETURN_REASON_LABELS[r.reason] ?? r.reason} />
              <Row
                label="Refund amount"
                value={formatPrice(r.refundAmount ?? 0, symbol)}
                strong
              />
              {r.resolution !== "pending" && (
                <Row label="Resolution" value={resolutionLabel(r.resolution)} />
              )}
              {r.refundStatus !== "not_applicable" && (
                <Row label="Refund status" value={r.refundStatus.replace(/_/g, " ")} />
              )}
            </dl>

            {r.rejectionReason && (
              <p className="mt-4 rounded-lg bg-error/10 p-3 text-xs text-error">
                {r.rejectionReason}
              </p>
            )}

            {r.comments && (
              <p className="mt-4 border-t border-line pt-4 text-xs text-muted">
                Your note: {r.comments}
              </p>
            )}
          </div>

          {r.reversePickup?.awb && (
            <div className="rounded-xl border border-line bg-surface p-6">
              <p className="eyebrow mb-3">Reverse pickup</p>
              <p className="text-sm text-heading">{r.reversePickup.courier}</p>
              <p className="text-xs text-muted">AWB {r.reversePickup.awb}</p>
              {r.reversePickup.trackingUrl && (
                <a
                  href={r.reversePickup.trackingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block text-sm text-link underline underline-offset-4"
                >
                  Track pickup →
                </a>
              )}
            </div>
          )}

          {customerCanCancel(r.status) && <CancelReturnButton requestId={params.id} />}

          <Link
            href="/contact"
            className="block rounded-xl border border-line bg-surface p-4 text-center text-sm text-link"
          >
            Need help with this return?
          </Link>
        </aside>
      </div>
    </main>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className={`text-right ${strong ? "font-semibold text-heading" : "text-heading"}`}>
        {value}
      </dd>
    </div>
  );
}

function resolutionLabel(resolution: string): string {
  const map: Record<string, string> = {
    refund_source: "Refund to original payment method",
    store_credit: "Store credit",
    replacement: "Replacement shipped",
    rejected: "Request rejected",
    pending: "Pending",
  };
  return map[resolution] ?? resolution;
}
