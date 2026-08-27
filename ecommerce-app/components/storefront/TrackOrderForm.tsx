"use client";

import { useState } from "react";
import Link from "next/link";
import { Package, Truck, CheckCircle2, Clock, XCircle } from "lucide-react";

interface TrackResult {
  orderNumber: string;
  orderStatus: string;
  placedAt: string;
  awb?: string;
  courierName?: string;
  trackingUrl?: string;
  itemCount: number;
  total: number;
  currencySymbol: string;
  statusHistory: { status: string; note?: string; at: string }[];
}

/** The happy path, in order. Cancelled/returned are handled separately. */
const STAGES = [
  { key: "placed", label: "Order placed", Icon: Clock },
  { key: "confirmed", label: "Confirmed", Icon: CheckCircle2 },
  { key: "shipped", label: "Shipped", Icon: Package },
  { key: "out_for_delivery", label: "Out for delivery", Icon: Truck },
  { key: "delivered", label: "Delivered", Icon: CheckCircle2 },
];

export function TrackOrderForm() {
  const [orderNumber, setOrderNumber] = useState("");
  const [contact, setContact] = useState("");
  const [result, setResult] = useState<TrackResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(
        `/api/orders/track?orderNumber=${encodeURIComponent(
          orderNumber.trim()
        )}&contact=${encodeURIComponent(contact.trim())}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not find that order");
      setResult(data.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not find that order");
    } finally {
      setLoading(false);
    }
  }

  // "processing" is an internal state between confirmed and shipped; map it
  // onto "confirmed" so the customer sees a tracker with no dead stages.
  const normalized =
    result?.orderStatus === "processing" ? "confirmed" : result?.orderStatus ?? "";
  const currentIndex = STAGES.findIndex((s) => s.key === normalized);
  const isTerminal = normalized === "cancelled" || normalized === "returned";

  return (
    <div className="space-y-8">
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-line bg-surface p-6">
        <div>
          <label htmlFor="orderNumber" className="mb-1.5 block text-sm font-medium text-heading">
            Order number
          </label>
          <input
            id="orderNumber"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            required
            placeholder="ZB-8F3K2A"
            className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-heading placeholder:text-muted focus:border-primary"
          />
        </div>
        <div>
          <label htmlFor="contact" className="mb-1.5 block text-sm font-medium text-heading">
            Email or phone used at checkout
          </label>
          <input
            id="contact"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            required
            placeholder="you@example.com"
            className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-heading placeholder:text-muted focus:border-primary"
          />
        </div>
        {error && <p className="text-sm text-error">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Looking up…" : "Track order"}
        </button>
      </form>

      {result && (
        <div className="rounded-xl border border-line bg-surface p-6">
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-4">
            <div>
              <p className="text-base font-medium text-heading">{result.orderNumber}</p>
              <p className="text-xs text-muted">
                Placed {new Date(result.placedAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}{" "}
                · {result.itemCount} item{result.itemCount === 1 ? "" : "s"}
              </p>
            </div>
            <p className="text-sm font-semibold text-heading">
              {result.currencySymbol}
              {result.total}
            </p>
          </div>

          {isTerminal ? (
            <div className="flex items-center gap-3 rounded-lg bg-surface-alt p-4">
              <XCircle size={20} className="text-error" />
              <p className="text-sm text-heading">
                This order was {normalized === "cancelled" ? "cancelled" : "returned"}.
              </p>
            </div>
          ) : (
            <ol className="space-y-0">
              {STAGES.map((stage, i) => {
                const done = currentIndex >= i;
                const isCurrent = currentIndex === i;
                return (
                  <li key={stage.key} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                          done
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-line bg-surface text-muted"
                        }`}
                      >
                        <stage.Icon size={15} />
                      </span>
                      {i < STAGES.length - 1 && (
                        <span
                          className={`w-px flex-1 ${done ? "bg-primary" : "bg-line"}`}
                          style={{ minHeight: 28 }}
                        />
                      )}
                    </div>
                    <div className="pb-6">
                      <p
                        className={`text-sm ${
                          isCurrent ? "font-semibold text-heading" : done ? "text-heading" : "text-muted"
                        }`}
                      >
                        {stage.label}
                      </p>
                      {isCurrent && result.awb && (
                        <p className="mt-0.5 text-xs text-muted">
                          {result.courierName} · AWB {result.awb}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {result.trackingUrl && (
            <a
              href={result.trackingUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block rounded-lg border border-line px-5 py-2.5 text-sm font-medium text-heading hover:border-primary"
            >
              Track with courier →
            </a>
          )}

          <p className="mt-6 text-xs text-muted">
            Something wrong?{" "}
            <Link href="/contact" className="text-link underline underline-offset-4">
              Get in touch
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
