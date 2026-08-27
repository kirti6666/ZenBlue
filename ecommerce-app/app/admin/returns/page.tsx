import Link from "next/link";
import { connectDB } from "@/lib/db";
import { ReturnRequest } from "@/models";
import { getSiteSettings, formatPrice } from "@/lib/site-settings";
import { AdminPageHeader, TableWrap, Th, Td, EmptyState, Pill, StatTile } from "@/components/admin/AdminPage";
import { RETURN_REASON_LABELS, RETURN_STATUS_LABELS } from "@/lib/returns";

export const dynamic = "force-dynamic";

export const metadata = { title: "Returns & exchanges" };

/** Which pill colour a status gets — outcome, not workflow position. */
function toneFor(status: string): "default" | "success" | "warning" | "error" | "info" {
  if (["completed", "refund_processed", "qc_passed", "approved"].includes(status)) return "success";
  if (["rejected", "cancelled"].includes(status)) return "error";
  if (["qc_failed"].includes(status)) return "warning";
  if (status === "requested") return "info";
  return "default";
}

const FILTERS = [
  { value: "", label: "All" },
  { value: "requested", label: "Needs review" },
  { value: "approved", label: "Approved" },
  { value: "picked_up", label: "In transit" },
  { value: "received", label: "At warehouse" },
  { value: "refund_initiated", label: "Refunding" },
  { value: "completed", label: "Completed" },
];

/**
 * The returns queue.
 *
 * Defaults to newest-first across every status rather than only open requests:
 * the shop owner's first question each morning is "what came in overnight",
 * and the status filter handles the narrower views.
 */
export default async function AdminReturnsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  await connectDB();
  const status = searchParams.status ?? "";

  const [requests, settings, counts] = await Promise.all([
    ReturnRequest.find(status ? { status } : {})
      .populate("order", "orderNumber total paymentMethod")
      .populate("user", "name email phone")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean(),
    getSiteSettings(),
    ReturnRequest.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);

  const countBy = Object.fromEntries(counts.map((c: any) => [c._id, c.count]));
  const symbol = settings.commerce.currencySymbol;

  const pendingRefund = (requests as any[]).filter((r) =>
    ["qc_passed", "refund_initiated"].includes(r.status)
  );

  return (
    <>
      <AdminPageHeader
        title="Returns & exchanges"
        description="Approve requests, run quality checks, and settle refunds or replacements."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Awaiting review"
          value={countBy.requested ?? 0}
          tone={(countBy.requested ?? 0) > 0 ? "warning" : "default"}
          hint="Customer is waiting"
        />
        <StatTile label="At warehouse" value={countBy.received ?? 0} hint="Needs a quality check" />
        <StatTile
          label="Refunds to settle"
          value={pendingRefund.length}
          hint={formatPrice(
            pendingRefund.reduce((s, r) => s + (r.refundAmount ?? 0), 0),
            symbol
          )}
        />
        <StatTile label="Completed" value={countBy.completed ?? 0} tone="success" />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/admin/returns?status=${f.value}` : "/admin/returns"}
            className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
              status === f.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-line text-body hover:border-primary"
            }`}
          >
            {f.label}
            {f.value && countBy[f.value] ? ` (${countBy[f.value]})` : ""}
          </Link>
        ))}
      </div>

      {requests.length === 0 ? (
        <EmptyState message="No return requests match this filter." />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>RMA</Th>
              <Th>Customer</Th>
              <Th>Order</Th>
              <Th>Type</Th>
              <Th>Reason</Th>
              <Th>Refund</Th>
              <Th>Status</Th>
              <Th>Raised</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {(requests as any[]).map((r) => (
              <tr key={String(r._id)} className="hover:bg-surface-alt">
                <Td className="font-medium">{r.rmaNumber}</Td>
                <Td>
                  <span className="block">{r.user?.name ?? "—"}</span>
                  <span className="block text-xs text-muted">{r.user?.email}</span>
                </Td>
                <Td className="text-xs">{r.order?.orderNumber ?? "—"}</Td>
                <Td>
                  <Pill tone={r.type === "exchange" ? "info" : "default"}>
                    {r.type === "exchange" ? "Exchange" : "Return"}
                  </Pill>
                </Td>
                <Td className="text-xs">{RETURN_REASON_LABELS[r.reason] ?? r.reason}</Td>
                <Td>{formatPrice(r.refundAmount ?? 0, symbol)}</Td>
                <Td>
                  <Pill tone={toneFor(r.status)}>{RETURN_STATUS_LABELS[r.status] ?? r.status}</Pill>
                </Td>
                <Td className="text-xs text-muted">
                  {new Date(r.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </Td>
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
      )}
    </>
  );
}
