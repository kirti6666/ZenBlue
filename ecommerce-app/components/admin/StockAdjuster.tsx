"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check } from "lucide-react";

/**
 * Inline stock correction.
 *
 * Uses "set to" rather than "add/subtract": staff arrive here holding a
 * physical count, and making them work out the difference is where counting
 * errors get introduced. The API turns the target into a signed delta so the
 * ledger still records a movement.
 */
export function StockAdjuster({
  productId,
  variantKey,
  currentStock,
}: {
  productId: string;
  variantKey: string;
  currentStock: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState(String(currentStock));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    const quantity = Number(value);
    if (!Number.isInteger(quantity) || quantity < 0) {
      setError("Enter a whole number");
      return;
    }
    if (quantity === currentStock) return;

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, variantKey, quantity, mode: "set" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not adjust stock");
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not adjust stock");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
        aria-label="Set stock level"
        className="w-16 rounded border border-line bg-surface px-2 py-1 text-sm text-heading"
      />
      <button
        type="button"
        onClick={save}
        disabled={saving || value === String(currentStock)}
        className="rounded border border-line px-2 py-1 text-xs text-heading disabled:opacity-40"
      >
        {saving ? "…" : saved ? <Check size={12} className="text-success" /> : "Set"}
      </button>
      {error && <span className="text-[10px] text-error">{error}</span>}
    </div>
  );
}
