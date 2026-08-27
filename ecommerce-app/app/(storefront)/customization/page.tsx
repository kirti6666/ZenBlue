import type { Metadata } from "next";
import { PenTool, Ruler, Scissors, Sparkles } from "lucide-react";
import { getSiteSettings } from "@/lib/site-settings";
import { PageHeader } from "@/components/storefront/PageHeader";
import { BulkEnquiryForm } from "@/components/storefront/BulkEnquiryForm";

export const metadata: Metadata = {
  title: "Customization",
  description:
    "Monograms, embroidery, custom colourways and made-to-measure fits on ZEN BLUE menswear. Tell us what you have in mind and we will quote within one working day.",
};

const SERVICES = [
  {
    icon: PenTool,
    title: "Monogram & embroidery",
    body: "Initials on the cuff or chest, or your artwork stitched in thread colours you pick.",
  },
  {
    icon: Scissors,
    title: "Custom colourways",
    body: "Any style in a fabric colour of your choosing, subject to a minimum run.",
  },
  {
    icon: Ruler,
    title: "Made to measure",
    body: "Send your measurements and we cut the pattern to them rather than to a size chart.",
  },
  {
    icon: Sparkles,
    title: "Occasion sets",
    body: "Matching pieces for a wedding party or a shoot, finished and packed together.",
  },
];

const STEPS = [
  { n: "01", title: "Send the brief", body: "The style, what you want changed, and your date." },
  { n: "02", title: "We quote", body: "Price, lead time and a placement mock-up for any artwork." },
  { n: "03", title: "Approve", body: "Sign off the proof — nothing is cut before you do." },
  { n: "04", title: "Made & shipped", body: "Produced to your spec and delivered to your address." },
];

/**
 * Customisation enquiries.
 *
 * Shares the enquiry form with /bulk-orders rather than duplicating it: the
 * fields a quote needs are identical (what, how many, by when, what branding),
 * and `kind="custom"` is what changes the copy, the quantity bands and the
 * subject line the enquiry lands under. A single piece is a valid customisation
 * order, which is the one place the two genuinely differ.
 */
export default async function CustomizationPage() {
  const settings = await getSiteSettings();
  const { integrations, contact, brand } = settings;

  return (
    <main>
      <PageHeader
        title="Customization"
        subtitle={`Monograms, embroidery, custom colourways and made-to-measure fits — ${brand.storeName} finished exactly how you want it.`}
        breadcrumbs={[{ name: "Customization", path: "/customization" }]}
        compact
      />

      <section className="mx-auto max-w-page px-4 py-7 sm:px-6 sm:py-9">
        <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0">
            <h2 className="font-display text-xl text-heading sm:text-2xl">Tell us what you need</h2>
            <p className="mt-1.5 text-sm text-body">
              One piece or a hundred — describe the change and we will price it.
            </p>
            <div className="mt-6">
              <BulkEnquiryForm kind="custom" whatsappNumber={integrations.whatsappNumber} />
            </div>
          </div>

          <aside className="lg:pt-14">
            <div className="rounded-xl border border-line bg-surface p-5">
              <h3 className="text-sm font-medium text-heading">Sending artwork?</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-body">
                Vector files (AI, EPS, SVG or PDF) reproduce best. Email or WhatsApp them across
                and we will return a placement mock-up with the quote.
              </p>
              <dl className="mt-4 space-y-2 text-sm">
                {(contact.supportEmail || contact.email) && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted">Email</dt>
                    <dd className="break-all">
                      <a
                        href={`mailto:${contact.supportEmail || contact.email}`}
                        className="text-link underline-offset-4 hover:underline"
                      >
                        {contact.supportEmail || contact.email}
                      </a>
                    </dd>
                  </div>
                )}
                {contact.phone && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted">Phone</dt>
                    <dd>
                      <a
                        href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}
                        className="text-link underline-offset-4 hover:underline"
                      >
                        {contact.phone}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </aside>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-page px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-line bg-surface p-5">
              <Icon size={20} strokeWidth={1.6} className="text-heading" />
              <h3 className="mt-3.5 text-sm font-medium text-heading">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-body">{body}</p>
            </div>
          ))}
        </div>
        </div>
      </section>

      <section className="border-y border-line">
        <div className="mx-auto max-w-page px-4 py-7 sm:px-6 sm:py-9">
          <h2 className="font-display text-xl text-heading sm:text-2xl">How it works</h2>
          <ol className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ n, title, body }) => (
              <li key={n}>
                <span className="font-display text-2xl text-muted">{n}</span>
                <h3 className="mt-2 text-sm font-medium text-heading">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-body">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

    </main>
  );
}
