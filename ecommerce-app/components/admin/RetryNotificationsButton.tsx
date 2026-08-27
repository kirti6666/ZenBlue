"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw } from "lucide-react";

/** Manually triggers the retry sweep for failed sends. */
export function RetryNotificationsButton({ failedCount }: { failedCount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");

  async function retry() {
    setBusy(true);
    setResult("");
    try {
      const res = await fetch("/api/notifications/retry", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Retry failed");
      setResult(`${json.sent} of ${json.retried} delivered`);
      router.refresh();
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {result && <span className="text-xs text-muted">{result}</span>}
      <button
        type="button"
        onClick={retry}
        disabled={busy || failedCount === 0}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-4 py-2.5 text-sm text-heading disabled:opacity-50"
      >
        <RefreshCw size={14} className={busy ? "animate-spin" : ""} />
        Retry failed ({failedCount})
      </button>
    </div>
  );
}
