import type { Metadata } from "next";
import { Award, Palette, Ruler, Truck } from "lucide-react";
import { getSiteSettings } from "@/lib/site-settings";
import { PageHeader } from "@/components/storefront/PageHeader";
import { BulkEnquiryForm } from "@/components/storefront/BulkEnquiryForm";

export const metadata: Metadata = {
  title: "Bulk & Corporate Orders",
  description:
    "Corporate gifting, wedding parties and team uniforms in ZEN BLUE menswear. Tell us what you need and we will quote within one working day.",
};

const PROPS = [
  {
    icon: Palette,
    title: "Custom colours & branding",
    body: "Embroidered logos, bespoke labels and colourways matched to your brand.",
  },
  {
    icon: Ruler,
    title: "Full size runs",
    body: "S to 4XL on every style, with a size set sent ahead of the main order.",
  },
  {
    icon: Truck,
    title: "Delivered on your date",
    body: "Production slots booked against your deadline, shipped pan-India.",
  },
  {
    icon: Award,
    title: "Volume pricing",
    body: "Tiered rates from 25 pieces, with GST invoicing for your accounts team.",
  },
];

const STEPS = [
  { n: "01", title: "Tell us what you need", body: "Styles, quantity, colours and your date." },
  { n: "02", title: "We quote", body: "Pricing, lead time and a mock-up within one working day." },
  { n: "03", title: "Sample & approve", body: "A size set and branding proof before we cut." },
  { n: "04", title: "Produced & delivered", body: "Made, packed and shipped to your address." },
];

const FAQS = [
  {
    q: "What is the minimum order?",
    a: "25 pieces across a style. Mixed sizes within that style are fine, and colours can be split from 50 pieces upwards.",
  },
  {
    q: "Can you put our logo on the garment?",
    a: "Yes — embroidery, screen print and woven labels. Send us vector artwork and we will return a placement mock-up with the quote.",
  },
  {
    q: "How long does a bulk order take?",
    a: "Typically 12–18 working days from approval of the sample, depending on quantity and customisation. Tell us your date and we will confirm what is achievable.",
  },
  {
    q: "Do you invoice with GST?",
    a: "Every bulk order ships with a GST invoice. Share your GSTIN when you accept the quote and it is carried onto the invoice.",
  },
];

/**
 * Bulk / corporate order landing page.
 *
 * A separate page from Contact Us on purpose: a corporate buyer arriving from a
 * search for "corporate gifting" can submit a brief immediately, while the
 * proof points, process and common questions remain available below the form.
 */
export default async function BulkOrdersPage() {
  const settings = await getSiteSettings();
  const { integrations, contact, brand } = settings;

  return (
    <main className="overflow-x-hidden">
      <PageHeader
        title="Bulk & Corporate Orders"
        subtitle={`Corporate gifting, wedding parties, team uniforms and retail wholesale — ${brand.storeName} menswear made to your quantity, your colours and your date.`}
        breadcrumbs={[{ name: "Bulk Orders", path: "/bulk-orders" }]}
        compact
      />

      <section className="mx-auto max-w-page px-3 py-5 sm:px-6 sm:py-9">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10">
          <div className="min-w-0">
            <h2 className="font-display text-lg text-heading sm:text-2xl">Request a quote</h2>
            <p className="mt-1 text-xs leading-relaxed text-body sm:mt-1.5 sm:text-sm">
              The more you can tell us here, the more precise the first quote will be.
            </p>
            <div className="mt-4 sm:mt-6">
              <BulkEnquiryForm whatsappNumber={integrations.whatsappNumber} />
            </div>
          </div>

          <aside className="min-w-0 lg:pt-14">
            <div className="rounded-lg border border-line bg-surface p-4 sm:rounded-xl sm:p-5">
              <h3 className="text-sm font-medium text-heading">Rather talk it through?</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-body">
                Our bulk desk is open Monday to Saturday.
              </p>
              <dl className="mt-4 space-y-2 text-sm">
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
                {contact.businessHours && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted">Hours</dt>
                    <dd className="text-body">{contact.businessHours}</dd>
                  </div>
                )}
              </dl>
            </div>
          </aside>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-page px-3 py-4 sm:px-6 sm:py-8">
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
          {PROPS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="min-w-0 rounded-lg border border-line bg-surface p-3 sm:rounded-xl sm:p-5">
              <Icon size={18} strokeWidth={1.6} className="text-heading sm:h-5 sm:w-5" />
              <h3 className="mt-2 text-xs font-medium leading-snug text-heading sm:mt-3.5 sm:text-sm">{title}</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-body sm:mt-1.5 sm:text-sm">{body}</p>
            </div>
          ))}
        </div>
        </div>
      </section>

      <section className="border-y border-line">
        <div className="mx-auto max-w-page px-3 py-5 sm:px-6 sm:py-9">
          <h2 className="font-display text-lg text-heading sm:text-2xl">How it works</h2>
          <ol className="mt-4 grid grid-cols-2 gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-4">
            {STEPS.map(({ n, title, body }) => (
              <li key={n} className="min-w-0">
                <span className="font-display text-xl text-muted sm:text-2xl">{n}</span>
                <h3 className="mt-1 text-xs font-medium leading-snug text-heading sm:mt-2 sm:text-sm">{title}</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-body sm:text-sm">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-page px-3 py-5 sm:px-6 sm:py-9">
          <h2 className="font-display text-lg text-heading sm:text-2xl">
            Bulk order questions
          </h2>
          <dl className="mt-4 grid gap-4 sm:mt-6 sm:grid-cols-2 sm:gap-6">
            {FAQS.map(({ q, a }) => (
              <div key={q}>
                <dt className="font-display text-sm text-heading sm:font-sans sm:font-medium">{q}</dt>
                <dd className="mt-1 text-xs leading-relaxed text-body sm:mt-1.5 sm:text-sm">{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </main>
  );
}
