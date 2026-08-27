"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

export interface ProfileValues {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  phoneVerified: boolean;
  dob: string;
  gender: "male" | "female" | "other" | "";
  marketingOptIn: boolean;
}

const FIELD =
  "w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-heading placeholder:text-muted focus:border-primary focus:outline-none disabled:bg-surface-alt disabled:text-muted";

/**
 * The "My Profile" form.
 *
 * Email is shown but not editable here: it is the sign-in identifier, so
 * changing it needs its own verify-the-new-address flow rather than being one
 * field among six. The customer is told why instead of being left to wonder
 * why the box will not focus.
 */
export function ProfileForm({ initial }: { initial: ProfileValues }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function update<K extends keyof ProfileValues>(key: K, value: ProfileValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setSaved(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: values.firstName,
          lastName: values.lastName,
          phone: values.phone,
          dob: values.dob,
          gender: values.gender,
          marketingOptIn: values.marketingOptIn,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save your details");
      setValues((v) => ({ ...v, ...json.profile }));
      setSaved(true);
      // The header greeting and the sidebar both render the name on the
      // server, so they need the new value.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your details");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm text-body">First Name</span>
          <input
            type="text"
            autoComplete="given-name"
            value={values.firstName}
            onChange={(e) => update("firstName", e.target.value)}
            className={FIELD}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-body">Last Name</span>
          <input
            type="text"
            autoComplete="family-name"
            value={values.lastName}
            onChange={(e) => update("lastName", e.target.value)}
            className={FIELD}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-body">Email Id</span>
          <input type="email" value={values.email} disabled readOnly className={FIELD} />
          <span className="mt-1 block text-xs text-muted">
            Your email is how you sign in — write to us to change it.
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-body">Mobile Number</span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="74878 59546"
            value={values.phone}
            onChange={(e) => update("phone", e.target.value)}
            className={FIELD}
          />
          {values.phone && (
            <span className="mt-1 block text-xs text-muted">
              {values.phoneVerified
                ? "Verified — you can sign in with this number."
                : "Not verified yet. Sign in once with an OTP on this number to verify it."}
            </span>
          )}
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-body">Date of Birth</span>
          <input
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={values.dob}
            onChange={(e) => update("dob", e.target.value)}
            className={FIELD}
          />
        </label>

        <fieldset className="block">
          <legend className="mb-1.5 block text-sm text-body">Gender</legend>
          <div className="flex flex-wrap gap-2 pt-1">
            {(["male", "female", "other"] as const).map((g) => (
              <button
                key={g}
                type="button"
                aria-pressed={values.gender === g}
                onClick={() => update("gender", values.gender === g ? "" : g)}
                className={`rounded-full border px-4 py-2 text-sm capitalize transition-colors ${
                  values.gender === g
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-line text-body hover:border-primary"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <label className="flex items-start gap-2.5 text-sm text-body">
        <input
          type="checkbox"
          checked={values.marketingOptIn}
          onChange={(e) => update("marketingOptIn", e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
        />
        Notify me with offers and updates
      </label>

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save Changes"}
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm text-success">
            <Check size={15} /> Saved
          </span>
        )}
      </div>
    </form>
  );
}
