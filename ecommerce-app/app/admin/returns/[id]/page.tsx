import { notFound } from "next/navigation";
import Link from "next/link";
import { connectDB } from "@/lib/db";
import { ReturnRequest } from "@/models";
import { getSiteSettings, formatPrice } from "@/lib/site-settings";
import { AdminPageHeader, Card } from "@/components/admin/AdminPage";
import { ReturnWorkflowPanel } from "@/components/admin/ReturnWorkflowPanel";
import { RETURN_REASON_LABELS, RETURN_STATUS_LABELS } from "@/lib/returns";

export const dynamic = "force-dynamic";

export const metadata = { title: "Return request" };

/** Full return record with the workflow controls alongside it. */
export default async function AdminReturnDetail({ params }: { params: { id: string } }) {
  await connectDB();
  const [request, settings] = await Promise.all([
    ReturnRequest.findById(params.id)
      .populate("order", "orderNumber total paymentMethod paymentStatus shippingAddress createdAt")
      .populate("user", "name email phone")
      .lean(),
    getSiteSettings(),
  ]);

  if (!request) notFound();
  const r = JSON.parse(JSON.stringify(request));
  const symbol = settings.commerce.currencySymbol;

  return (
    <>
      <AdminPageHeader
        title={r.rmaNumber}
        description={`${r.type === "exchange" ? "Exchange" : "Return"} · ${
          RETURN_STATUS_LABELS[r.status] ?? r.status
        }`}
        actions={
          <Link
            href="/admin/returns"
            className="rounded-lg border border-line px-4 py-2 text-sm text-heading hover:border-primary"
          >
            Back to queue
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h2 className="mb-4 text-base font-medium text-heading">Items</h2>
            <ul className="divide-y divide-line">
              {r.items.map((item: any, i: number) => (
                <li key={i} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image} alt="" className="h-20 w-16 rounded-md object-cover" />
                  ) : (
                    <div className="h-20 w-16 rounded-md bg-surface-alt" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-heading">{item.title}</p>
                    {item.variantKey && <p className="text-xs text-muted">{item.variantKey}</p>}
                    <p className="mt-1 text-xs text-muted">
                      Qty {item.quantity} · {formatPrice(item.unitPrice, symbol)} each
                    </p>
                    {item.exchangeVariantKey && (
                      <p className="mt-1 text-xs text-link">
                        Wants: {item.exchangeVariantKey}
                      </p>
                    )}
                    {item.qcResult !== "pending" && (
                      <p className="mt-1 text-xs text-muted">
                        QC {item.qcResult} · {item.disposition.replace(/_/g, " ")}
                        {item.qcRemarks ? ` — ${item.qcRemarks}` : ""}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {r.images?.length > 0 && (
            <Card>
              <h2 className="mb-3 text-base font-medium text-heading">Customer photos</h2>
              <div className="flex flex-wrap gap-3">
                {r.images.map((url: string, i: number) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-24 w-24 rounded-lg object-cover" />
                  </a>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <h2 className="mb-4 text-base font-medium text-heading">Timeline</h2>
            <ol className="space-y-3">
              {(r.timeline ?? []).map((entry: any, i: number) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p className="text-heading">
                      {RETURN_STATUS_LABELS[entry.status] ?? entry.status}
                    </p>
                    {entry.note && <p className="text-xs text-muted">{entry.note}</p>}
                    <p className="text-xs text-muted">
                      {new Date(entry.at).toLocaleString("en-IN")}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <p className="eyebrow mb-3">Customer</p>
            <p className="text-sm text-heading">{r.user?.name}</p>
            <p className="text-xs text-muted">{r.user?.email}</p>
            {r.user?.phone && <p className="text-xs text-muted">{r.user.phone}</p>}
            <div className="mt-4 border-t border-line pt-4 text-xs text-muted">
              <p>Order {r.order?.orderNumber}</p>
              <p>
                {formatPrice(r.order?.total ?? 0, symbol)} · {r.order?.paymentMethod?.toUpperCase()} ·{" "}
                {r.order?.paymentStatus}
              </p>
            </div>
            <div className="mt-4 border-t border-line pt-4 text-xs">
              <p className="text-muted">Reason</p>
              <p className="text-heading">{RETURN_REASON_LABELS[r.reason] ?? r.reason}</p>
              {r.comments && <p className="mt-2 text-muted">“{r.comments}”</p>}
            </div>
          </Card>

          <ReturnWorkflowPanel request={r} currencySymbol={symbol} />
        </div>
      </div>
    </>
  );
}
