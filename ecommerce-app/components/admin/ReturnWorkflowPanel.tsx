"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RETURN_TRANSITIONS, RETURN_STATUS_LABELS } from "@/lib/returns";

/**
 * The action panel for a return request.
 *
 * It renders only the transitions the server would actually accept, read from
 * the same transition table the API validates against — so the UI can never
 * offer a button that produces a 400. Each action collects exactly the extra
 * input its transition requires (a rejection reason, QC results, a resolution)
 * and nothing more.
 */
export function ReturnWorkflowPanel({
  request,
  currencySymbol,
}: {
  request: any;
  currencySymbol: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [rejectionReason, setRejectionReason] = useState("");
  const [resolution, setResolution] = useState<string>(
    request.resolution !== "pending" ? request.resolution : "refund_source"
  );
  const [refundAmount, setRefundAmount] = useState<number>(request.refundAmount ?? 0);
  const [adminNotes, setAdminNotes] = useState(request.adminNotes ?? "");
  const [courier, setCourier] = useState(request.reversePickup?.courier ?? "");
  const [awb, setAwb] = useState(request.reversePickup?.awb ?? "");
  const [qc, setQc] = useState<Record<number, { result: string; remarks: string; disposition: string }>>(
    {}
  );

  const next = RETURN_TRANSITIONS[request.status] ?? [];

  async function send(body: Record<string, unknown>) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/returns/${request._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Update failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setLoading(false);
    }
  }

  const needsQc = request.status === "received";
  const needsResolution = request.status === "qc_passed" || request.status === "qc_failed";

  return (
    <div className="space-y-4">
      {request.replacementOrder && (
        <div className="rounded-xl border border-success/40 bg-success/5 p-5">
          <p className="eyebrow mb-2">Replacement order</p>
          <p className="text-sm font-medium text-heading">
            {request.replacementOrder.orderNumber}
          </p>
          <p className="mt-1 text-xs text-muted">
            {String(request.replacementOrder.orderStatus).replace(/_/g, " ")} · stock reserved
          </p>
        </div>
      )}

      <div className="rounded-xl border border-line bg-surface p-5">
        <p className="eyebrow mb-3">Actions</p>

        {next.length === 0 ? (
          <p className="text-sm text-muted">
            This request is closed — no further action is available.
          </p>
        ) : (
          <div className="space-y-3">
            {/* Approve / reject */}
            {next.includes("approved") && (
              <button
                type="button"
                disabled={loading}
                onClick={() => send({ status: "approved" })}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                Approve request
              </button>
            )}

            {next.includes("rejected") && (
              <div className="rounded-lg border border-line p-3">
                <label className="block text-xs text-muted">
                  Rejection reason (shown to the customer)
                </label>
                <input
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Item shows signs of wear"
                  className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-heading"
                />
                <button
                  type="button"
                  disabled={loading || !rejectionReason.trim()}
                  onClick={() => send({ status: "rejected", rejectionReason })}
                  className="mt-2 w-full rounded-lg border border-error px-4 py-2 text-sm font-medium text-error disabled:opacity-50"
                >
                  Reject request
                </button>
              </div>
            )}

            {/* Reverse pickup */}
            {next.includes("pickup_scheduled") && (
              <div className="rounded-lg border border-line p-3">
                <p className="mb-2 text-xs text-muted">Schedule reverse pickup</p>
                <input
                  value={courier}
                  onChange={(e) => setCourier(e.target.value)}
                  placeholder="Courier name"
                  className="mb-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-heading"
                />
                <input
                  value={awb}
                  onChange={(e) => setAwb(e.target.value)}
                  placeholder="Pickup AWB"
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-heading"
                />
                <button
                  type="button"
                  disabled={loading || !awb.trim()}
                  onClick={() =>
                    send({ status: "pickup_scheduled", reversePickup: { courier, awb } })
                  }
                  className="mt-2 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  Save pickup details
                </button>
              </div>
            )}

            {next.includes("picked_up") && (
              <button
                type="button"
                disabled={loading}
                onClick={() => send({ status: "picked_up" })}
                className="w-full rounded-lg border border-line px-4 py-2.5 text-sm text-heading"
              >
                Mark as picked up
              </button>
            )}

            {next.includes("received") && (
              <button
                type="button"
                disabled={loading}
                onClick={() => send({ status: "received" })}
                className="w-full rounded-lg border border-line px-4 py-2.5 text-sm text-heading"
              >
                Mark as received at warehouse
              </button>
            )}
          </div>
        )}

        {error && <p className="mt-3 text-xs text-error">{error}</p>}
      </div>

      {/* Quality check */}
      {needsQc && (
        <div className="rounded-xl border border-line bg-surface p-5">
          <p className="eyebrow mb-3">Quality check</p>
          <ul className="space-y-4">
            {request.items.map((item: any, i: number) => {
              const entry = qc[i] ?? { result: "passed", remarks: "", disposition: "sellable" };
              return (
                <li key={i} className="border-b border-line pb-4 last:border-0 last:pb-0">
                  <p className="text-sm text-heading">{item.title}</p>
                  {item.variantKey && <p className="text-xs text-muted">{item.variantKey}</p>}

                  <div className="mt-2 flex gap-2">
                    {(["passed", "failed"] as const).map((res) => (
                      <button
                        key={res}
                        type="button"
                        onClick={() =>
                          setQc((prev) => ({
                            ...prev,
                            [i]: {
                              ...entry,
                              result: res,
                              // A failed item must never go straight back on sale.
                              disposition: res === "passed" ? "sellable" : "quarantined",
                            },
                          }))
                        }
                        className={`flex-1 rounded-lg border px-3 py-1.5 text-xs ${
                          entry.result === res
                            ? res === "passed"
                              ? "border-success bg-success/10 text-success"
                              : "border-error bg-error/10 text-error"
                            : "border-line text-body"
                        }`}
                      >
                        {res === "passed" ? "Passed" : "Failed"}
                      </button>
                    ))}
                  </div>

                  <select
                    value={entry.disposition}
                    onChange={(e) =>
                      setQc((prev) => ({ ...prev, [i]: { ...entry, disposition: e.target.value } }))
                    }
                    className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-heading"
                  >
                    <option value="sellable">Back to sellable stock</option>
                    <option value="quarantined">Quarantine</option>
                    <option value="written_off">Write off</option>
                  </select>

                  <input
                    value={entry.remarks}
                    onChange={(e) =>
                      setQc((prev) => ({ ...prev, [i]: { ...entry, remarks: e.target.value } }))
                    }
                    placeholder="Remarks (optional)"
                    className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-heading"
                  />
                </li>
              );
            })}
          </ul>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                send({
                  status: "qc_passed",
                  qc: request.items.map((_: any, i: number) => ({
                    index: i,
                    ...(qc[i] ?? { result: "passed", remarks: "", disposition: "sellable" }),
                  })),
                })
              }
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              Save as passed
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                send({
                  status: "qc_failed",
                  qc: request.items.map((_: any, i: number) => ({
                    index: i,
                    ...(qc[i] ?? { result: "failed", remarks: "", disposition: "quarantined" }),
                  })),
                })
              }
              className="flex-1 rounded-lg border border-warning px-4 py-2 text-sm font-medium text-warning disabled:opacity-60"
            >
              Save as failed
            </button>
          </div>
        </div>
      )}

      {/* Resolution */}
      {needsResolution && (
        <div className="rounded-xl border border-line bg-surface p-5">
          <p className="eyebrow mb-3">Choose resolution</p>

          <label className="block text-xs text-muted">Resolution</label>
          <select
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-heading"
          >
            <option value="refund_source">Refund to original payment method</option>
            <option value="store_credit">Issue store credit</option>
            {request.type === "exchange" && (
              <option value="replacement">Send a replacement</option>
            )}
          </select>

          {resolution !== "replacement" && (
            <>
              <label className="mt-3 block text-xs text-muted">
                Refund amount ({currencySymbol})
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(Number(e.target.value))}
                className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-heading"
              />
            </>
          )}

          {resolution === "replacement" && (
            <p className="mt-3 rounded-lg bg-surface-alt p-3 text-xs text-muted">
              This creates a linked, no-charge order using the requested variants and reserves its
              stock immediately.
            </p>
          )}

          <button
            type="button"
            disabled={loading}
            onClick={() =>
              send({
                status: resolution === "replacement" ? "completed" : "refund_initiated",
                resolution,
                refundAmount,
              })
            }
            className="mt-3 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {resolution === "replacement"
              ? "Generate replacement order"
              : resolution === "store_credit"
                ? "Issue store credit"
                : "Initiate refund"}
          </button>
        </div>
      )}

      {(next.includes("refund_processed") || next.includes("completed")) && (
        <div className="rounded-xl border border-line bg-surface p-5">
          <p className="eyebrow mb-3">Close out</p>
          {next.includes("refund_processed") && (
            <button
              type="button"
              disabled={loading}
              onClick={() => send({ status: "refund_processed" })}
              className="mb-2 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              Mark refund as processed
            </button>
          )}
          {next.includes("completed") && (
            <button
              type="button"
              disabled={loading}
              onClick={() => send({ status: "completed" })}
              className="w-full rounded-lg border border-line px-4 py-2.5 text-sm text-heading"
            >
              Complete &amp; issue credit note
            </button>
          )}
        </div>
      )}

      <div className="rounded-xl border border-line bg-surface p-5">
        <p className="eyebrow mb-2">Internal notes</p>
        <textarea
          value={adminNotes}
          onChange={(e) => setAdminNotes(e.target.value)}
          rows={3}
          placeholder="Not shown to the customer"
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-heading"
        />
        <button
          type="button"
          disabled={loading}
          onClick={() => send({ adminNotes })}
          className="mt-2 w-full rounded-lg border border-line px-4 py-2 text-sm text-heading"
        >
          Save note
        </button>
      </div>
    </div>
  );
}
