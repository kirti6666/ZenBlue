"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";

/**
 * Footer newsletter signup.
 *
 * Posts to /api/newsletter, which is deliberately idempotent — re-subscribing
 * an existing address succeeds quietly rather than leaking whether that email
 * is already on the list.
 */
export function NewsletterForm({
  buttonText,
  successMessage,
}: {
  buttonText: string;
  successMessage: string;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setState("loading");
    setError("");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source: "footer" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not subscribe");
      setState("done");
      setEmail("");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Could not subscribe");
    }
  }

  if (state === "done") {
    return (
      <p className="flex items-center justify-center gap-2 text-sm text-success md:justify-start">
        <Check size={16} /> {successMessage}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div className="flex overflow-hidden rounded-lg border border-line bg-surface focus-within:border-primary">
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <input
          id="newsletter-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-left text-xs text-heading placeholder:text-muted focus:outline-none sm:py-2.5 sm:text-sm"
        />
        <button
          type="submit"
          disabled={state === "loading"}
          className="inline-flex shrink-0 items-center gap-1 bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 sm:gap-1.5 sm:px-4 sm:text-sm"
        >
          {state === "loading" ? "…" : buttonText}
          <ArrowRight size={14} />
        </button>
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
    </form>
  );
}
