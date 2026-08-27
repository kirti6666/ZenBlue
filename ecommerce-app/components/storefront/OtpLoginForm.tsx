"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * Passwordless sign-in.
 *
 * Two steps: identifier, then code. The identifier field accepts either an
 * email or a phone number and the server picks the channel, because asking a
 * shopper to first choose "email or SMS" is a decision they do not need to make.
 */
export function OtpLoginForm({ onCancel }: { onCancel: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get("callbackUrl") || "/account";

  const [step, setStep] = useState<"identifier" | "code">("identifier");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const codeRef = useRef<HTMLInputElement>(null);

  // Countdown for the resend link.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), purpose: "login" }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.retryAfter) setCooldown(json.retryAfter);
        throw new Error(json.error ?? "Could not send a code");
      }
      setChannel(json.channel);
      setStep("code");
      setCooldown(45);
      if (json.devCode) setCode(json.devCode);
      if (json.undelivered) {
        setNotice(json.devCode
          ? `Development preview code: ${json.devCode}`
          : "Email delivery is not configured yet. Please contact the store administrator."
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send a code");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), code: code.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not verify that code");

      router.push(json.user?.role === "admin" || json.user?.role === "staff" ? "/admin" : callbackUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify that code");
      setBusy(false);
    }
  }

  if (step === "identifier") {
    return (
      <form onSubmit={sendCode} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-heading">
            Email or phone number
          </span>
          <input
            type="text"
            required
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="you@example.com or 98765 43210"
            className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-heading placeholder:text-muted"
          />
        </label>

        {error && <p className="text-sm text-error">{error}</p>}

        <button
          type="submit"
          disabled={busy || !identifier.trim()}
          className="w-full rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send me a code"}
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="w-full text-sm text-link underline underline-offset-4"
        >
          Use a password instead
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      <button
        type="button"
        onClick={() => {
          setStep("identifier");
          setCode("");
          setError("");
        }}
        className="inline-flex items-center gap-1.5 text-sm text-link"
      >
        <ArrowLeft size={14} />
        Change {channel === "sms" ? "number" : "email"}
      </button>

      <p className="text-sm text-body">
        We sent a 6-digit code to <strong className="text-heading">{identifier}</strong>.
      </p>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-heading">Verification code</span>
        <input
          ref={codeRef}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="••••••"
          className="w-full rounded-lg border border-line bg-surface px-3.5 py-3 text-center text-lg tracking-[0.5em] text-heading placeholder:tracking-[0.5em]"
        />
      </label>

      {notice && <p className="text-xs text-warning">{notice}</p>}
      {error && <p className="text-sm text-error">{error}</p>}

      <button
        type="submit"
        disabled={busy || code.length < 4}
        className="w-full rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Verifying…" : "Verify and sign in"}
      </button>

      <button
        type="button"
        disabled={cooldown > 0 || busy}
        onClick={() => sendCode()}
        className="w-full text-sm text-link underline underline-offset-4 disabled:text-muted disabled:no-underline"
      >
        {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
      </button>
    </form>
  );
}
