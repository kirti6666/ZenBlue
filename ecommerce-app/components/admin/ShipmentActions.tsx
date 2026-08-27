"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Books a shipment for one order, inline in the dispatch queue.
 *
 * Opens a small form rather than firing immediately, because both operating
 * modes need input: with a live courier API the operator picks a service, and
 * in manual mode they paste the AWB they just booked on the courier's own
 * dashboard. The same submit handles both — a supplied AWB always wins over
 * whatever the API returned.
 */
export function ShipmentActions({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rates, setRates] = useState<any[] | null>(null);
  const [awb, setAwb] = useState("");
  const [courier, setCourier] = useState("");
  const [tracking, setTracking] = useState("");

  async function loadRates() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/shipments/rates?orderId=${orderId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not fetch rates");
      setRates(json.rates ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not fetch rates");
    } finally {
      setBusy(false);
    }
  }

  async function book(courierId?: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          direction: "forward",
          courierId,
          manualAwb: awb.trim() || undefined,
          manualCourierName: courier.trim() || undefined,
          manualTrackingUrl: tracking.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not book the shipment");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not book the shipment");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-line px-3 py-1.5 text-xs text-heading hover:border-primary"
      >
        Ship
      </button>
    );
  }

  return (
    <div className="min-w-[15rem] rounded-lg border border-line bg-surface p-3">
      <div className="space-y-2">
        <input
          value={awb}
          onChange={(e) => setAwb(e.target.value)}
          placeholder="AWB number"
          aria-label="AWB number"
          className="w-full rounded border border-line bg-surface px-2.5 py-1.5 text-xs text-heading"
        />
        <input
          value={courier}
          onChange={(e) => setCourier(e.target.value)}
          placeholder="Courier name"
          aria-label="Courier name"
          className="w-full rounded border border-line bg-surface px-2.5 py-1.5 text-xs text-heading"
        />
        <input
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
          placeholder="Tracking URL (optional)"
          aria-label="Tracking URL"
          className="w-full rounded border border-line bg-surface px-2.5 py-1.5 text-xs text-heading"
        />
      </div>

      {rates && rates.length > 0 && (
        <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto">
          {rates.map((r) => (
            <li key={r.courierId}>
              <button
                type="button"
                onClick={() => book(r.courierId)}
                className="flex w-full justify-between gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-surface-alt"
              >
                <span className="text-heading">{r.courierName}</span>
                <span className="text-muted">
                  ₹{r.rate} · {r.estimatedDays}d
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-2 text-[11px] text-error">{error}</p>}

      <div className="mt-2 flex gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => book()}
          className="flex-1 rounded bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
        >
          {busy ? "…" : "Book"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={loadRates}
          className="rounded border border-line px-2.5 py-1.5 text-xs text-heading"
        >
          Rates
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-line px-2.5 py-1.5 text-xs text-muted"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
