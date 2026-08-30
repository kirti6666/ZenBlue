"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Upload, X } from "lucide-react";
import { RETURN_REASON_LABELS } from "@/lib/returns";
import { RETURN_WINDOW_STATEMENT } from "@/lib/return-policy";

interface ReturnableItem {
  index: number;
  product: string;
  title: string;
  image: string;
  variant: Record<string, string>;
  variantKey: string;
  unitPrice: number;
  orderedQuantity: number;
  returnedQuantity: number;
  returnableQuantity: number;
  exchangeOptions: {
    variant: Record<string, string>;
    variantKey: string;
    stock: number;
    image: string;
  }[];
}

interface Eligibility {
  eligible: boolean;
  reason?: string;
  returnableItems: ReturnableItem[];
  policySummary: string;
  exchangeEnabled: boolean;
  windowDays: number;
  windowClosesAt?: string;
}

export function ReturnRequestForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<Eligibility | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [type, setType] = useState<"return" | "exchange">(
    searchParams.get("mode") === "exchange" ? "exchange" : "return"
  );
  const [reason, setReason] = useState("size_fit_issue");
  const [comments, setComments] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  // Keyed by "productId::variantKey" so two sizes of the same product stay distinct.
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [exchangeSelections, setExchangeSelections] = useState<
    Record<string, Record<string, string>>
  >({});

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/returns/eligibility?orderId=${orderId}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not load this order");
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load this order");
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId]);

  const keyOf = (item: ReturnableItem) => `${item.product}::${item.variantKey}`;

  function toggle(item: ReturnableItem) {
    const key = keyOf(item);
    setSelected((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = 1;
      return next;
    });
    setExchangeSelections((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function uploadImage(file: File) {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setImages((prev) => [...prev, json.url].slice(0, 6));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const items = Object.entries(selected).map(([key, quantity]) => {
      const [product, variantKey = ""] = key.split("::");
      return {
        product,
        variantKey,
        quantity,
        exchangeVariant: type === "exchange" ? exchangeSelections[key] : undefined,
      };
    });

    if (items.length === 0) {
      setError("Select at least one item to return");
      return;
    }
    if (
      type === "exchange" &&
      items.some((request) => {
        const item = data?.returnableItems.find(
          (candidate) => candidate.product === request.product && candidate.variantKey === request.variantKey
        );
        const targetKey = request.exchangeVariant
          ? Object.keys(request.exchangeVariant).sort().map((name) => `${name}:${request.exchangeVariant![name]}`).join(" / ")
          : "";
        return !item?.exchangeOptions.some((option) => option.variantKey === targetKey && option.stock >= request.quantity);
      })
    ) {
      setError("Choose an available replacement size and colour for every selected item");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, type, reason, comments, images, items }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not submit the request");
      router.push(`/account/returns/${json.returnRequest._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit the request");
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">Loading your order…</p>;
  }

  if (!data || !data.eligible) {
    return (
      <div className="rounded-xl border border-line bg-surface p-8 text-center">
        <AlertCircle size={24} className="mx-auto mb-3 text-warning" />
        <p className="text-sm text-heading">{data?.reason ?? error ?? "This order cannot be returned"}</p>
        <Link
          href="/account/orders"
          className="mt-4 inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
        >
          Back to orders
        </Link>
      </div>
    );
  }

  const selectedCount = Object.keys(selected).length;
  const estimatedRefund = data.returnableItems
    .filter((i) => selected[keyOf(i)])
    .reduce((sum, i) => sum + i.unitPrice * selected[keyOf(i)], 0);

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="rounded-lg bg-surface-alt p-4 text-sm text-body">
        <p>{data.policySummary}</p>
        <p className="mt-2 font-medium text-heading">{RETURN_WINDOW_STATEMENT}</p>
      </div>

      {/* Type */}
      {data.exchangeEnabled && (
        <fieldset className="rounded-xl border border-line bg-surface p-5">
          <legend className="px-1 text-sm font-medium text-heading">What would you like?</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {(["return", "exchange"] as const).map((t) => (
              <label
                key={t}
                className={`cursor-pointer rounded-lg border p-4 text-sm transition-colors ${
                  type === t ? "border-primary bg-surface-alt" : "border-line"
                }`}
              >
                <input
                  type="radio"
                  name="type"
                  value={t}
                  checked={type === t}
                  onChange={() => setType(t)}
                  className="sr-only"
                />
                <span className="block font-medium text-heading">
                  {t === "return" ? "Return for a refund" : "Exchange size or colour"}
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  {t === "return"
                    ? "Money back to your original payment method or as store credit"
                    : "We send a replacement once we collect the original"}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {/* Items */}
      <fieldset className="rounded-xl border border-line bg-surface p-5">
        <legend className="px-1 text-sm font-medium text-heading">Select items</legend>
        <ul className="mt-3 divide-y divide-line">
          {data.returnableItems.map((item) => {
            const key = keyOf(item);
            const isSelected = !!selected[key];
            const disabled = item.returnableQuantity === 0;

            return (
              <li key={key} className={`py-4 first:pt-0 last:pb-0 ${disabled ? "opacity-50" : ""}`}>
                <div className="flex gap-4">
                  <input
                    type="checkbox"
                    id={`item-${key}`}
                    checked={isSelected}
                    disabled={disabled}
                    onChange={() => toggle(item)}
                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--primary)]"
                  />
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image} alt="" className="h-20 w-16 rounded-md object-cover" />
                  ) : (
                    <div className="h-20 w-16 rounded-md bg-surface-alt" />
                  )}
                  <div className="min-w-0 flex-1">
                    <label htmlFor={`item-${key}`} className="block text-sm font-medium text-heading">
                      {item.title}
                    </label>
                    {item.variantKey && <p className="text-xs text-muted">{item.variantKey}</p>}
                    <p className="mt-1 text-xs text-muted">
                      ₹{item.unitPrice} ·{" "}
                      {disabled
                        ? "Already returned"
                        : `${item.returnableQuantity} of ${item.orderedQuantity} returnable`}
                    </p>

                    {isSelected && item.returnableQuantity > 1 && (
                      <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                        Quantity
                        <select
                          value={selected[key]}
                          onChange={(e) =>
                            setSelected((prev) => ({ ...prev, [key]: Number(e.target.value) }))
                          }
                          className="rounded border border-line bg-surface px-2 py-1 text-heading"
                        >
                          {Array.from({ length: item.returnableQuantity }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    {isSelected && type === "exchange" && (
                      <div className="mt-3 rounded-lg border border-line bg-surface-alt p-3">
                        <p className="text-xs font-semibold text-heading">Choose your replacement</p>
                        {item.exchangeOptions.length === 0 ? (
                          <p className="mt-1 text-xs text-error">No alternative size or colour is currently in stock.</p>
                        ) : (
                          <div className="mt-2 space-y-2.5">
                            {[...new Set(item.exchangeOptions.flatMap((option) => Object.keys(option.variant)))].map((attribute) => {
                              const choice = exchangeSelections[key] ?? {};
                              const values = [...new Set(item.exchangeOptions.map((option) => option.variant[attribute]).filter(Boolean))];
                              return (
                                <div key={attribute}>
                                  <span className="text-[11px] font-medium text-muted">{attribute}</span>
                                  <div className="mt-1 flex flex-wrap gap-1.5">
                                    {values.map((value) => {
                                      const available = item.exchangeOptions.some((option) =>
                                        option.stock >= (selected[key] ?? 1) &&
                                        option.variant[attribute] === value &&
                                        Object.entries(choice).every(([name, selectedValue]) => name === attribute || option.variant[name] === selectedValue)
                                      );
                                      const active = choice[attribute] === value;
                                      return (
                                        <button key={value} type="button" disabled={!available} onClick={() => setExchangeSelections((prev) => ({ ...prev, [key]: { ...(prev[key] ?? {}), [attribute]: value } }))} className={`rounded-md border px-2.5 py-1.5 text-xs transition ${active ? "border-primary bg-primary text-primary-foreground" : available ? "border-line bg-surface text-heading hover:border-primary" : "cursor-not-allowed border-line text-muted opacity-40"}`}>
                                          {value}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </fieldset>

      {/* Reason */}
      <fieldset className="rounded-xl border border-line bg-surface p-5">
        <legend className="px-1 text-sm font-medium text-heading">Why are you sending it back?</legend>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-3 w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-heading"
        >
          {Object.entries(RETURN_REASON_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={3}
          placeholder="Anything else we should know? (optional)"
          className="mt-3 w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-heading placeholder:text-muted"
        />

        {/* Photos matter most for damage claims, so prompt for them there. */}
        <div className="mt-4">
          <p className="text-xs text-muted">
            {reason === "damaged_or_defective" || reason === "wrong_item_received"
              ? "Please add a photo — it speeds up approval considerably."
              : "Add a photo (optional)"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {images.map((url, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-16 w-16 rounded-md object-cover" />
                <button
                  type="button"
                  onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                  aria-label="Remove photo"
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-error p-0.5 text-white"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
            {images.length < 6 && (
              <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-md border border-dashed border-line text-muted hover:border-primary">
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
                />
                {uploading ? "…" : <Upload size={16} />}
              </label>
            )}
          </div>
        </div>
      </fieldset>

      {selectedCount > 0 && type === "return" && (
        <div className="rounded-xl border border-line bg-surface-alt p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Estimated refund</span>
            <span className="font-semibold text-heading">₹{estimatedRefund.toFixed(2)}</span>
          </div>
          <p className="mt-1 text-xs text-muted">
            Final amount is confirmed after our quality check, and reflects any discount applied to
            the original order.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-error">{error}</p>}

      <button
        type="submit"
        disabled={submitting || selectedCount === 0}
        className="w-full rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Submitting…" : `Submit ${type} request`}
      </button>
    </form>
  );
}
