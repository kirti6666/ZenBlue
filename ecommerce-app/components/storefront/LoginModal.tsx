"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BadgePercent, Lock, RefreshCcw, X } from "lucide-react";

/**
 * Sign-in popup — mobile number, one-time code, done.
 *
 * The three panels on the left are not decoration: this asks for a phone
 * number before showing anything of value, and stating what the number buys
 * (offers, easy returns) and what it will not be used for (no spam) is what
 * makes a stranger type it in.
 *
 * Below `sm` the benefit panel is dropped rather than stacked above the form —
 * on a phone it would push the input below the fold, which is exactly the
 * field the sheet exists to collect.
 */
const BENEFITS = [
  {
    icon: BadgePercent,
    title: "Exclusive Updates",
    body: "Early access to drops, and offers before they go public.",
  },
  {
    icon: RefreshCcw,
    title: "Easy Return",
    body: "Track orders and raise a return or exchange in a tap.",
  },
  {
    icon: Lock,
    title: "100% secure and spam free",
    body: "Your number is used to sign you in — never sold on.",
  },
];

/** Ten digits, the Indian mobile format the +91 prefix implies. */
const MOBILE_RE = /^[6-9]\d{9}$/;

export function LoginModal({
  open,
  onClose,
  callbackUrl = "/account",
}: {
  open: boolean;
  onClose: () => void;
  callbackUrl?: string;
}) {
  const router = useRouter();

  const [step, setStep] = useState<"mobile" | "code">("mobile");
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [optIn, setOptIn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const mobileRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  const valid = MOBILE_RE.test(mobile);

  const openAlternativeSignIn = () => {
    onClose();
    router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  };

  // Reset on close, so re-opening never shows a stale code step or error.
  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => {
      setStep("mobile");
      setCode("");
      setError("");
      setNotice("");
    }, 200);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(
      () => (step === "code" ? codeRef.current : mobileRef.current)?.focus(),
      60
    );
    return () => clearTimeout(t);
  }, [open, step]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!MOBILE_RE.test(mobile)) {
        setError("Enter a 10-digit mobile number");
        return;
      }
      setBusy(true);
      setError("");
      setNotice("");
      try {
        const res = await fetch("/api/auth/otp/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: `+91${mobile}`, purpose: "login" }),
        });
        const json = await res.json();
        if (!res.ok) {
          if (json.retryAfter) setCooldown(json.retryAfter);
          throw new Error(json.error ?? "Could not send a code");
        }
        setStep("code");
        setCooldown(45);
        if (json.devCode) setCode(json.devCode);
        if (json.undelivered) {
          setNotice(json.devCode
            ? `Development preview code: ${json.devCode}`
            : "SMS delivery is not configured yet. Please contact the store administrator."
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not send a code");
      } finally {
        setBusy(false);
      }
    },
    [mobile]
  );

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: `+91${mobile}`,
          code: code.trim(),
          marketingOptIn: optIn,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not verify that code");

      onClose();
      const isStaff = json.user?.role === "admin" || json.user?.role === "staff";
      router.push(isStaff ? "/admin" : callbackUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify that code");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  // The account button lives inside the sticky, backdrop-filtered header.
  // Backdrop filters establish a containing block for fixed descendants, so a
  // modal rendered there can be clipped to the header instead of the viewport.
  // Portalling to body restores true viewport-fixed positioning.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sign in"
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-5"
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />

      <div className="relative z-10 flex min-h-0 max-h-[calc(100dvh-1.5rem)] w-full max-w-[430px] overflow-hidden rounded-3xl bg-background shadow-2xl sm:max-h-[calc(100dvh-2.5rem)] sm:max-w-3xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-20 rounded-full p-1.5 text-muted transition-colors hover:bg-surface-alt hover:text-heading"
        >
          <X size={18} />
        </button>

        {/* LEFT — why a stranger should hand over their number */}
        <div className="hidden min-h-0 w-[46%] shrink-0 flex-col justify-center gap-5 overflow-y-auto bg-surface-alt p-6 sm:flex lg:gap-6 lg:p-8">
          {BENEFITS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-3.5">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background text-heading">
                <Icon size={17} strokeWidth={1.7} />
              </span>
              <div>
                <p className="text-sm font-medium text-heading">{title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-body">{body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* RIGHT — the form */}
        <div className="flex min-h-0 flex-1 items-center overflow-y-auto overscroll-contain p-5 sm:p-6 lg:p-8">
          {step === "mobile" ? (
            <form onSubmit={sendCode} className="mx-auto w-full max-w-md space-y-4 sm:space-y-5">
              <div className="px-5 text-center sm:px-3">
                <h2 className="font-display text-xl font-semibold text-heading">
                  Unlock Exclusive Deals
                </h2>
                <p className="mt-1 text-sm text-body">
                  Sign in securely with a one-time password.
                </p>
              </div>

              <label className="block">
                <span className="sr-only">Mobile number</span>
                <div className="flex items-stretch overflow-hidden rounded-xl border border-line bg-surface shadow-sm transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
                  <span className="flex items-center border-r border-line px-3 text-sm text-body">
                    +91
                  </span>
                  <input
                    ref={mobileRef}
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    maxLength={10}
                    required
                    value={mobile}
                    onChange={(e) => {
                      setMobile(e.target.value.replace(/\D/g, "").slice(0, 10));
                      setError("");
                    }}
                    placeholder="74878 59546"
                    className="w-full bg-transparent px-3.5 py-2.5 text-sm text-heading placeholder:text-muted focus:outline-none"
                  />
                </div>
              </label>

              <label className="flex items-center justify-center gap-2.5 text-sm text-body sm:justify-start">
                <input
                  type="checkbox"
                  checked={optIn}
                  onChange={(e) => setOptIn(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
                />
                Notify me with offers and updates
              </label>

              {error && <p className="text-sm text-error">{error}</p>}

              <button
                type="submit"
                disabled={busy || !valid}
                className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
              >
                {busy ? "Sending…" : "Submit"}
              </button>

              <p className="text-center text-[11px] leading-relaxed text-muted">
                By continuing you agree to our{" "}
                <Link href="/pages/terms" className="underline underline-offset-2">
                  Terms &amp; Conditions
                </Link>{" "}
                and{" "}
                <Link href="/pages/privacy" className="underline underline-offset-2">
                  Privacy Policy
                </Link>
                .
              </p>

              <p className="text-center text-xs text-muted">
                Prefer email?{" "}
                <button
                  type="button"
                  onClick={openAlternativeSignIn}
                  className="text-link underline underline-offset-2"
                >
                  Sign in another way
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={verify} className="mx-auto w-full max-w-md space-y-4 sm:space-y-5">
              <button
                type="button"
                onClick={() => {
                  setStep("mobile");
                  setCode("");
                  setError("");
                }}
                className="inline-flex items-center gap-1.5 text-sm text-link"
              >
                <ArrowLeft size={14} /> Change number
              </button>

              <div className="text-center">
                <h2 className="font-display text-xl font-semibold text-heading">
                  Enter the code
                </h2>
                <p className="mt-1 text-sm text-body">
                  Sent to <strong className="text-heading">+91 {mobile}</strong>.
                </p>
              </div>

              <label className="block">
                <span className="sr-only">Verification code</span>
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
                  className="w-full rounded-lg border border-line bg-surface px-3.5 py-3 text-center text-lg tracking-[0.5em] text-heading focus:border-primary focus:outline-none"
                />
              </label>

              {notice && <p className="text-xs text-warning">{notice}</p>}
              {error && <p className="text-sm text-error">{error}</p>}

              <button
                type="submit"
                disabled={busy || code.length < 4}
                className="w-full rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {busy ? "Verifying…" : "Verify and continue"}
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
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
