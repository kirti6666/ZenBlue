"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card } from "./AdminPage";

/**
 * Admin controls for one customer: block/unblock, marketing consent, and a
 * manual store-credit adjustment.
 *
 * Role changes are deliberately absent — promoting someone to staff happens
 * under Staff & permissions, which requires full admin, so this screen cannot
 * be used as a privilege-escalation path.
 */
export function CustomerActions({
  customerId,
  isBlocked,
  marketingOptIn,
  currencySymbol,
}: {
  customerId: string;
  isBlocked: boolean;
  marketingOptIn: boolean;
  currencySymbol: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditNote, setCreditNote] = useState("");

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
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
      setBusy(false);
    }
  }

  async function issueCredit() {
    const amount = Number(creditAmount);
    if (!amount) {
      setError("Enter an amount");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: customerId,
          amount,
          reason: "goodwill",
          note: creditNote || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not adjust the wallet");
      setCreditAmount("");
      setCreditNote("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not adjust the wallet");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <p className="eyebrow mb-3">Actions</p>

      <label className="mb-3 flex items-center justify-between gap-3 text-sm">
        <span className="text-heading">Marketing emails</span>
        <input
          type="checkbox"
          checked={marketingOptIn}
          disabled={busy}
          onChange={(e) => patch({ marketingOptIn: e.target.checked })}
          className="h-4 w-4 accent-[var(--primary)]"
        />
      </label>

      <button
        type="button"
        disabled={busy}
        onClick={() => patch({ isBlocked: !isBlocked })}
        className={`w-full rounded-lg border px-4 py-2.5 text-sm font-medium disabled:opacity-60 ${
          isBlocked ? "border-line text-heading" : "border-error text-error"
        }`}
      >
        {isBlocked ? "Unblock account" : "Block account"}
      </button>
      <p className="mt-1.5 text-xs text-muted">
        A blocked account is signed out within 15 minutes and cannot log back in.
      </p>

      <div className="mt-5 border-t border-line pt-4">
        <p className="eyebrow mb-2.5">Issue store credit</p>
        <div className="flex gap-2">
          <span className="flex items-center text-sm text-muted">{currencySymbol}</span>
          <input
            type="number"
            step="0.01"
            value={creditAmount}
            onChange={(e) => setCreditAmount(e.target.value)}
            placeholder="500"
            aria-label="Credit amount"
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-heading"
          />
        </div>
        <input
          value={creditNote}
          onChange={(e) => setCreditNote(e.target.value)}
          placeholder="Reason (optional)"
          className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-heading"
        />
        <button
          type="button"
          disabled={busy || !creditAmount}
          onClick={issueCredit}
          className="mt-2 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Add credit
        </button>
        <p className="mt-1.5 text-xs text-muted">
          Use a negative amount to deduct. Every adjustment is written to the audit log.
        </p>
      </div>

      {error && <p className="mt-3 text-xs text-error">{error}</p>}
    </Card>
  );
}
