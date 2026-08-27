import type { Metadata } from "next";
import { Mail, Phone, MapPin, Clock, MessageCircle } from "lucide-react";
import { getSiteSettings, whatsappLink } from "@/lib/site-settings";
import { PageHeader } from "@/components/storefront/PageHeader";
import { ContactForm } from "@/components/storefront/ContactForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with the ZenBlue team by email, phone or WhatsApp. We reply within one working day.",
  alternates: { canonical: "/contact" },
};

/**
 * Contact page — form, direct channels, WhatsApp click-to-chat and an optional
 * map embed. Every detail here comes from Site Settings so the client can
 * change an address or a phone number without a deploy.
 */
export default async function ContactPage() {
  const settings = await getSiteSettings();
  const { contact, integrations } = settings;
  const waHref = whatsappLink(settings);
  const email = contact.supportEmail || contact.email;

  const channels = [
    email && { Icon: Mail, label: "Email", value: email, href: `mailto:${email}` },
    contact.phone && {
      Icon: Phone,
      label: "Phone",
      value: contact.phone,
      href: `tel:${contact.phone}`,
    },
    contact.businessHours && { Icon: Clock, label: "Hours", value: contact.businessHours },
    contact.address && { Icon: MapPin, label: "Address", value: contact.address },
  ].filter(Boolean) as {
    Icon: typeof Mail;
    label: string;
    value: string;
    href?: string;
  }[];

  return (
    <main>
      <PageHeader
        title="Contact us"
        subtitle="Questions about sizing, an order, or a return? We usually reply within one working day."
        breadcrumbs={[{ name: "Contact", path: "/contact" }]}
        compact
      />

      <div className="mx-auto grid max-w-5xl gap-7 px-4 py-5 sm:px-6 sm:py-8 lg:grid-cols-5 lg:gap-10">
        <div className="lg:col-span-3">
          <h2 className="mb-1 font-display text-lg text-heading sm:text-xl">Send us a message</h2>
          <p className="mb-3 text-xs leading-relaxed text-muted sm:mb-4 sm:text-sm">
            Include your order number if your question is about an existing order — it gets you a
            faster answer.
          </p>
          <ContactForm />
        </div>

        <aside className="space-y-6 lg:col-span-2">
          {waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-xl border border-line bg-surface p-5 transition-colors hover:border-primary"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white">
                <MessageCircle size={18} />
              </span>
              <span>
                <span className="block text-sm font-medium text-heading">Chat on WhatsApp</span>
                <span className="block text-xs text-muted">Fastest way to reach us</span>
              </span>
            </a>
          )}

          {channels.length > 0 && (
            <div className="rounded-xl border border-line bg-surface p-5">
              <p className="eyebrow mb-4">Reach us directly</p>
              <ul className="space-y-4">
                {channels.map(({ Icon, label, value, href }) => (
                  <li key={label} className="flex gap-3">
                    <Icon size={16} className="mt-0.5 shrink-0 text-muted" />
                    <div>
                      <p className="text-xs text-muted">{label}</p>
                      {href ? (
                        <a href={href} className="text-sm text-heading hover:text-link">
                          {value}
                        </a>
                      ) : (
                        <p className="text-sm text-heading">{value}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {integrations.mapEmbedUrl && (
            <div className="overflow-hidden rounded-xl border border-line">
              <iframe
                src={integrations.mapEmbedUrl}
                title="Our location"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-64 w-full border-0"
              />
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
