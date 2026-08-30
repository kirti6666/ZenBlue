"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw, RotateCcw, XCircle } from "lucide-react";
import { RETURN_WINDOW_STATEMENT } from "@/lib/return-policy";

/**
 * Return and cancel controls for a customer's own order.
 *
 * Both eligibility checks are made on the server and passed in, so this
 * component never offers an action the API would reject — and when an action is
 * unavailable it says why, rather than silently hiding.
 */
export function OrderActions({
  orderId,
  orderNumber,
  canCancel,
  canReturn,
  returnBlockedReason,
  returnWindowClosesAt,
  policySummary,
  exchangeEnabled,
}: {
  orderId: string;
  orderNumber: string;
  canCancel: boolean;
  canReturn: boolean;
  returnBlockedReason?: string;
  returnWindowClosesAt?: string;
  policySummary: string;
  exchangeEnabled: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function cancel() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not cancel this order");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel this order");
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  if (!canCancel && !canReturn && !returnBlockedReason) return null;

  return (
    <div className="mb-6 rounded-md border p-4">
      {canReturn && (
        <>
          <p className="mb-2 text-sm text-gray-600">{policySummary}</p>
          <p className="mb-3 text-xs text-gray-500">{RETURN_WINDOW_STATEMENT}</p>
          <div className="flex flex-wrap gap-2">
            <Link href={`/account/returns/new?orderId=${orderId}&mode=return`} className="inline-flex items-center gap-2 rounded-md border border-primary px-4 py-2.5 text-sm font-medium text-primary">
              <RotateCcw size={15} /> Return
            </Link>
            {exchangeEnabled && (
              <Link href={`/account/returns/new?orderId=${orderId}&mode=exchange`} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">
                <RefreshCw size={15} /> Exchange size or colour
              </Link>
            )}
          </div>
          {returnWindowClosesAt && (
            <p className="mt-2 text-xs text-gray-500">
              Window closes{" "}
              {new Date(returnWindowClosesAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              .
            </p>
          )}
        </>
      )}

      {!canReturn && returnBlockedReason && (
        <p className="text-sm text-gray-500">{returnBlockedReason}</p>
      )}

      {canCancel && (
        <div className={canReturn || returnBlockedReason ? "mt-4 border-t pt-4" : ""}>
          {confirming ? (
            <div>
              <p className="text-sm font-medium">Cancel order {orderNumber}?</p>
              <p className="mt-1 text-xs text-gray-500">
                Stock goes back on sale immediately. Anything already paid is refunded as store
                credit, and a PDF credit note is emailed to you.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={cancel}
                  disabled={busy}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {busy ? "Cancelling…" : "Yes, cancel it"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="rounded-md border px-4 py-2 text-sm"
                >
                  Keep my order
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="inline-flex items-center gap-2 text-sm text-red-600 hover:underline"
            >
              <XCircle size={15} />
              Cancel this order
            </button>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
