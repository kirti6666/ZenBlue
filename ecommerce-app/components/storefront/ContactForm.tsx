"use client";

import { useState } from "react";
import { Check } from "lucide-react";

/**
 * Contact Us form.
 *
 * Includes a hidden `website` honeypot: bots fill every field they find, so a
 * non-empty value is treated server-side as spam. It costs nothing and avoids
 * putting a CAPTCHA in front of a genuine customer with a delivery problem.
 */
export function ContactForm() {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setState("loading");
    setError("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not send your message");
      setState("done");
      form.reset();
    } catch (err) {
      setState("idle");
      setError(err instanceof Error ? err.message : "Could not send your message");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-xl border border-line bg-surface p-8 text-center">
        <span className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-success/10 text-success">
          <Check size={20} />
        </span>
        <p className="text-base font-medium text-heading">Message sent</p>
        <p className="mt-1 text-sm text-muted">
          Thanks for writing in — we will get back to you within one working day.
        </p>
        <button
          type="button"
          onClick={() => setState("idle")}
          className="mt-4 text-sm text-link underline underline-offset-4"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2.5 text-left sm:space-y-3">
      <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
        <Field label="Your name" name="name" required placeholder="Rohan Mehta" />
        <Field label="Email" name="email" type="email" required placeholder="you@example.com" />
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
        <Field label="Phone (optional)" name="phone" type="tel" placeholder="+91 98765 43210" />
        <Field label="Subject" name="subject" placeholder="Order ZB-8F3K2A — sizing" />
      </div>

      <div>
        <label htmlFor="message" className="mb-1 block text-xs font-medium text-heading sm:text-sm">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          required
          minLength={10}
          rows={4}
          placeholder="Tell us what you need help with…"
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-heading placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
        />
      </div>

      {/* Honeypot — visually and programmatically hidden from real users. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />

      {error && <p role="alert" className="text-sm text-error">{error}</p>}

      <button
        type="submit"
        disabled={state === "loading"}
        className="w-full rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto"
      >
        {state === "loading" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-xs font-medium text-heading sm:text-sm">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        autoComplete={name === "name" ? "name" : name === "email" ? "email" : name === "phone" ? "tel" : undefined}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-heading placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
      />
    </div>
  );
}
