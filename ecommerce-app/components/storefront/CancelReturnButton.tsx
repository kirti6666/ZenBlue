"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Lets a customer withdraw a return request while it is still cancellable.
 * Confirmed inline rather than with window.confirm — a native dialog is easy to
 * dismiss accidentally on mobile, and this is a destructive action.
 */
export function CancelReturnButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function cancel() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/returns/${requestId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not cancel");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel");
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="w-full rounded-xl border border-line bg-surface p-4 text-sm text-error transition-colors hover:border-error"
        >
          Cancel this request
        </button>
        {error && <p className="mt-2 text-xs text-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-error/40 bg-surface p-4">
      <p className="text-sm text-heading">Cancel this return request?</p>
      <p className="mt-1 text-xs text-muted">
        You can raise a new one later, as long as the return window is still open.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={cancel}
          disabled={loading}
          className="flex-1 rounded-lg bg-error px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "Cancelling…" : "Yes, cancel"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="flex-1 rounded-lg border border-line px-3 py-2 text-sm text-heading"
        >
          Keep it
        </button>
      </div>
    </div>
  );
}
