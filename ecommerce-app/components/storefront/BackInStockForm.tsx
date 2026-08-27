"use client";

import { useState } from "react";
import { BellRing, Check } from "lucide-react";

/**
 * "Notify me when this is back" capture, shown in place of Add to Cart when the
 * selected variant is sold out.
 *
 * Registered against the specific variant, not the product — someone waiting on
 * a Medium does not want an email about the XL coming back.
 */
export function BackInStockForm({
  productId,
  variantKey,
  variantLabel,
}: {
  productId: string;
  variantKey: string;
  variantLabel?: string;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    setError("");
    try {
      const res = await fetch("/api/back-in-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, variantKey, email: email.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not register your alert");
      setState("done");
    } catch (err) {
      setState("idle");
      setError(err instanceof Error ? err.message : "Could not register your alert");
    }
  }

  if (state === "done") {
    return (
      <p className="flex items-center gap-2 rounded-lg bg-success/10 p-4 text-sm text-success">
        <Check size={16} />
        We will email you the moment {variantLabel ? `${variantLabel} is` : "this is"} back.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-line bg-surface-alt p-4">
      <p className="mb-2.5 flex items-center gap-2 text-sm font-medium text-heading">
        <BellRing size={15} className="text-warning" />
        {variantLabel ? `${variantLabel} is sold out` : "Sold out"}
      </p>
      <p className="mb-3 text-xs text-muted">
        Leave your email and we will tell you as soon as it is restocked.
      </p>
      <div className="flex gap-2">
        <label htmlFor="bis-email" className="sr-only">
          Email address
        </label>
        <input
          id="bis-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-heading placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={state === "loading"}
          className="shrink-0 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {state === "loading" ? "…" : "Notify me"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-error">{error}</p>}
    </form>
  );
}
