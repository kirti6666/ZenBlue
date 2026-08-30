"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, MessageCircle } from "lucide-react";

const FIELD =
  "h-10 w-full rounded-lg border border-line bg-surface px-3 text-left text-sm text-heading placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10";
const LABEL = "mb-1 block text-xs font-medium text-heading sm:text-sm";

const BULK_QUANTITIES = ["25 – 50", "50 – 100", "100 – 250", "250 – 500", "500+"];
/** Customisation starts at one piece — a monogrammed shirt is a single order. */
const CUSTOM_QUANTITIES = ["1 – 5", "5 – 25", "25 – 50", "50 – 100", "100+"];

const EMPTY = {
  name: "",
  email: "",
  phone: "",
  company: "",
  productInterest: "",
  quantity: "",
  budget: "",
  needByDate: "",
  customisation: "",
  message: "",
  website: "", // honeypot
};

/**
 * Bulk / corporate order enquiry.
 *
 * Two ways to send the same enquiry, deliberately: the form (which lands in
 * the admin queue and the support inbox) and a WhatsApp hand-off that
 * pre-fills the identical details into a chat. Corporate buyers overwhelmingly
 * prefer the second, and a form they will not fill in is worth nothing — but
 * the WhatsApp route leaves no record on our side, so the form stays primary.
 *
 * The WhatsApp message is built from whatever is typed so far, so the buyer
 * never re-types anything to switch channels.
 */
export function BulkEnquiryForm({
  whatsappNumber,
  kind = "bulk",
}: {
  whatsappNumber: string;
  /** "custom" reframes the copy and drops the 25-piece minimum. */
  kind?: "bulk" | "custom";
}) {
  const isCustom = kind === "custom";
  const QUANTITIES = isCustom ? CUSTOM_QUANTITIES : BULK_QUANTITIES;
  const [values, setValues] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");

  function update(key: keyof typeof EMPTY, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  const whatsappHref = useMemo(() => {
    const digits = whatsappNumber.replace(/\D/g, "");
    if (!digits) return "";
    const lines = [
      isCustom
        ? "Hi ZEN BLUE, I'd like a quote for a customised order."
        : "Hi ZEN BLUE, I'd like a quote for a bulk order.",
      values.name && `Name: ${values.name}`,
      values.company && `Company: ${values.company}`,
      values.productInterest && `Looking for: ${values.productInterest}`,
      values.quantity && `Quantity: ${values.quantity}`,
      values.needByDate && `Needed by: ${values.needByDate}`,
      values.customisation && `Customisation: ${values.customisation}`,
      values.message && `Notes: ${values.message}`,
    ].filter(Boolean);
    return `https://wa.me/${digits}?text=${encodeURIComponent(lines.join("\n"))}`;
  }, [whatsappNumber, values, isCustom]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/enquiries/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, kind }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not send your enquiry");
      setReference(json.reference ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your enquiry");
    } finally {
      setBusy(false);
    }
  }

  if (reference) {
    return (
      <div className="rounded-xl border border-line bg-surface p-5 text-center sm:p-6">
        <CheckCircle2 size={30} className="mx-auto text-success" strokeWidth={1.6} />
        <h3 className="mt-3 font-display text-xl text-heading">Enquiry received</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-body">
          Your reference is <strong className="text-heading">{reference}</strong>. Our team will
          come back to you within one working day with pricing and lead times.
        </p>
        {whatsappHref && (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-5 py-2.5 text-sm font-medium text-white"
          >
            <MessageCircle size={16} /> Continue on WhatsApp
          </a>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 text-left">
      {/* Honeypot — hidden from people, irresistible to bots. */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={values.website}
        onChange={(e) => update("website", e.target.value)}
        className="hidden"
      />

      <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
        <label className="block">
          <span className={LABEL}>
            Your name <span className="text-error">*</span>
          </span>
          <input
            required
            autoComplete="name"
            placeholder="Your full name"
            value={values.name}
            onChange={(e) => update("name", e.target.value)}
            className={FIELD}
          />
        </label>

        <label className="block">
          <span className={LABEL}>Company / organisation</span>
          <input
            autoComplete="organization"
            placeholder="Optional"
            value={values.company}
            onChange={(e) => update("company", e.target.value)}
            className={FIELD}
          />
        </label>

        <label className="block">
          <span className={LABEL}>
            Email <span className="text-error">*</span>
          </span>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={values.email}
            onChange={(e) => update("email", e.target.value)}
            className={FIELD}
          />
        </label>

        <label className="block">
          <span className={LABEL}>
            Mobile number <span className="text-error">*</span>
          </span>
          <input
            type="tel"
            inputMode="tel"
            required
            autoComplete="tel"
            placeholder="+91 74878 59546"
            value={values.phone}
            onChange={(e) => update("phone", e.target.value)}
            className={FIELD}
          />
        </label>

        <label className="block sm:col-span-2">
          <span className={LABEL}>What are you looking for?</span>
          <input
            placeholder="Describe the products you need"
            value={values.productInterest}
            onChange={(e) => update("productInterest", e.target.value)}
            className={FIELD}
          />
        </label>

        <fieldset className="sm:col-span-2">
          <legend className={LABEL}>Approximate quantity</legend>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {QUANTITIES.map((q) => (
              <button
                key={q}
                type="button"
                aria-pressed={values.quantity === q}
                onClick={() => update("quantity", values.quantity === q ? "" : q)}
                className={`min-h-9 rounded-full border px-3 py-1.5 text-xs transition-colors sm:text-sm ${
                  values.quantity === q
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-line text-body hover:border-primary"
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className={LABEL}>Budget per piece (optional)</span>
          <input
            placeholder="₹1,200 – ₹1,800"
            value={values.budget}
            onChange={(e) => update("budget", e.target.value)}
            className={FIELD}
          />
        </label>

        <label className="block">
          <span className={LABEL}>Needed by</span>
          <input
            type="date"
            min={new Date().toISOString().slice(0, 10)}
            value={values.needByDate}
            onChange={(e) => update("needByDate", e.target.value)}
            className={FIELD}
          />
        </label>

        <label className="block sm:col-span-2">
          <span className={LABEL}>Branding or customisation</span>
          <input
            placeholder="Describe any branding or customisation requirements"
            value={values.customisation}
            onChange={(e) => update("customisation", e.target.value)}
            className={FIELD}
          />
        </label>

        <label className="block sm:col-span-2">
          <span className={LABEL}>Anything else</span>
          <textarea
            rows={3}
            value={values.message}
            onChange={(e) => update("message", e.target.value)}
            className={`${FIELD} h-auto min-h-24 resize-y py-2`}
          />
        </label>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex flex-col gap-2.5 sm:flex-row">
        <button
          type="submit"
          disabled={busy}
          className="h-10 w-full rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 sm:w-auto"
        >
          {busy ? "Sending…" : "Send enquiry"}
        </button>

        {whatsappHref && (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#25D366] px-6 text-sm font-medium text-[#128C7E] transition-colors hover:bg-[#25D366]/10 sm:w-auto"
          >
            <MessageCircle size={16} /> Enquire on WhatsApp
          </a>
        )}
      </div>

      <p className="text-xs text-muted">
        {isCustom
          ? "We reply to customisation enquiries within one working day. Single pieces welcome."
          : "We reply to bulk enquiries within one working day. Minimum order 25 pieces."}
      </p>
    </form>
  );
}
