"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getProviders, signIn } from "next-auth/react";
import { ShieldCheck } from "lucide-react";
import { OtpLoginForm } from "@/components/storefront/OtpLoginForm";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Sign-in, with three paths: password, one-time code, and Google.
 *
 * Back-office accounts with two-factor enabled get an extra step — the
 * password call returns `requiresTwoFactor` and issues no session cookie until
 * the code is verified.
 */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get("callbackUrl") || "/account";

  const [mode, setMode] = useState<"password" | "otp">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState<boolean | null>(null);

  // Two-factor challenge state.
  const [twoFactor, setTwoFactor] = useState<{
    identifier: string;
    sentTo: string;
    channel: string;
    undelivered?: boolean;
  } | null>(null);
  const [code, setCode] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    getProviders()
      .then((providers) => {
        if (active) setGoogleReady(Boolean(providers?.google));
      })
      .catch(() => {
        if (active) setGoogleReady(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleGoogleSignIn() {
    setError("");
    if (!googleReady) {
      setError(
        googleReady === null
          ? "Checking Google sign-in configuration…"
          : "Google sign-in is not configured yet. Add the Google OAuth client ID and secret."
      );
      return;
    }
    await signIn("google", { callbackUrl });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }

      if (data.requiresTwoFactor) {
        setTwoFactor({
          identifier: data.identifier,
          sentTo: data.sentTo,
          channel: data.channel,
          undelivered: data.undelivered,
        });
        setTimeout(() => codeRef.current?.focus(), 50);
        return;
      }

      router.push(
        data.user.role === "admin" || data.user.role === "staff" ? "/admin" : callbackUrl
      );
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyTwoFactor(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          identifier: twoFactor?.identifier,
          code: code.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Verification failed");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ---- Two-factor step ----
  if (twoFactor) {
    return (
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <span className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-alt text-heading">
            <ShieldCheck size={20} />
          </span>
          <h1 className="font-display text-2xl font-semibold text-heading">
            Two-factor verification
          </h1>
          <p className="mt-1.5 text-sm text-body">
            We sent a code to <strong className="text-heading">{twoFactor.sentTo}</strong>.
          </p>
        </div>

        <form onSubmit={verifyTwoFactor} className="space-y-4">
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
              className="w-full rounded-lg border border-line bg-surface px-3.5 py-3 text-center text-lg tracking-[0.5em] text-heading"
            />
          </label>

          {twoFactor.undelivered && (
            <p className="text-xs text-warning">
              No delivery provider is configured yet — check the server log for the code.
            </p>
          )}
          {error && <p className="text-sm text-error">{error}</p>}

          <button
            type="submit"
            disabled={loading || code.length < 4}
            className="w-full rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {loading ? "Verifying…" : "Verify and continue"}
          </button>

          <button
            type="button"
            onClick={() => {
              setTwoFactor(null);
              setCode("");
              setError("");
            }}
            className="w-full text-sm text-link underline underline-offset-4"
          >
            Back to sign in
          </button>
        </form>
      </div>
    );
  }

  // ---- One-time code step ----
  if (mode === "otp") {
    return (
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-heading">Sign in</h1>
          <p className="mt-1 text-sm text-body">
            No password needed — we will send you a one-time code.
          </p>
        </div>
        <OtpLoginForm onCancel={() => setMode("password")} />
      </div>
    );
  }

  // ---- Password step ----
  return (
    <div className="w-full max-w-sm space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-heading">Sign in</h1>
        <p className="mt-1 text-sm text-body">Welcome back.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-heading">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-heading"
          />
        </label>
        <PasswordInput
          id="login-password"
          label="Password"
          labelAction={
            <Link href="/forgot-password" className="text-xs text-link underline underline-offset-4">
              Forgot password?
            </Link>
          }
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p className="text-sm text-error">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setMode("otp")}
        className="w-full rounded-lg border border-line py-3 text-sm font-medium text-heading hover:border-primary"
      >
        Sign in with a one-time code
      </button>

      <div className="relative text-center text-sm text-muted">
        <span className="relative z-10 bg-background px-2">or</span>
        <div className="absolute inset-x-0 top-1/2 border-t border-line" />
      </div>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        aria-disabled={googleReady !== true}
        className="w-full rounded-lg border border-line py-3 text-sm font-medium text-heading transition-colors hover:border-primary aria-disabled:cursor-not-allowed aria-disabled:text-muted"
      >
        {googleReady === null ? "Checking Google sign-in…" : "Continue with Google"}
      </button>

      <p className="text-center text-sm text-muted">
        New here?{" "}
        <Link href="/register" className="text-link underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center p-6">
      {/* useSearchParams needs a Suspense boundary in the App Router. */}
      <Suspense fallback={<div className="w-full max-w-md space-y-4"><Skeleton className="h-8 w-28"/><Skeleton className="h-12 w-full"/><Skeleton className="h-12 w-full"/><Skeleton className="h-12 w-full"/></div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
