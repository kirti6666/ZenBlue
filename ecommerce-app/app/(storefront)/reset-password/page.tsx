"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, KeyRound } from "lucide-react";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Skeleton } from "@/components/ui/Skeleton";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not reset your password");
      setComplete(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reset your password");
    } finally {
      setLoading(false);
    }
  }

  if (complete) {
    return (
      <div className="w-full max-w-sm text-center">
        <CheckCircle2 size={36} className="mx-auto text-success" />
        <h1 className="mt-4 font-display text-2xl font-semibold text-heading">Password updated</h1>
        <p className="mt-2 text-sm text-body">You can now sign in with your new password.</p>
        <Link
          href="/login"
          className="mt-6 inline-flex w-full justify-center rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground"
        >
          Continue to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-alt text-heading">
        <KeyRound size={18} />
      </span>
      <h1 className="font-display text-2xl font-semibold text-heading">Choose a new password</h1>
      <p className="mt-1.5 text-sm text-body">Use at least 8 characters.</p>

      {!token ? (
        <div className="mt-6">
          <p className="rounded-lg border border-line bg-surface-alt p-4 text-sm text-error">
            This reset link is incomplete. Request a new password reset email.
          </p>
          <Link href="/forgot-password" className="mt-4 inline-block text-sm text-link underline">
            Request a new link
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <PasswordInput
            id="new-password"
            label="New password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <PasswordInput
            id="confirm-password"
            label="Confirm new password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
          {error && <p className="text-sm text-error">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {loading ? "Updating…" : "Update password"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-5 py-10">
      <Suspense fallback={<div className="w-full max-w-md space-y-4"><Skeleton className="h-8 w-40"/><Skeleton className="h-12 w-full"/><Skeleton className="h-12 w-full"/><Skeleton className="h-12 w-full"/></div>}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
