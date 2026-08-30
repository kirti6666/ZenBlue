"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not send the reset link");
      setMessage(data.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send the reset link");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-alt text-heading">
          <Mail size={18} />
        </span>
        <h1 className="font-display text-2xl font-semibold text-heading">Reset your password</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-body">
          Enter your account email and we will send a secure reset link valid for 30 minutes.
        </p>

        {message ? (
          <div className="mt-6 rounded-lg border border-line bg-surface-alt p-4 text-sm leading-relaxed text-heading">
            {message}
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-heading">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-heading"
              />
            </label>
            {error && <p className="text-sm text-error">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <Link
          href="/login"
          className="mt-5 inline-flex items-center gap-1.5 text-sm text-link underline underline-offset-4"
        >
          <ArrowLeft size={14} /> Back to sign in
        </Link>
      </div>
    </main>
  );
}

