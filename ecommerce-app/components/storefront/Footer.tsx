import Link from "next/link";
import {
  Facebook,
  Instagram,
  Twitter,
  Youtube,
  Linkedin,
  MessageCircle,
  Mail,
  Phone,
  MapPin,
  Clock,
  ChevronDown,
} from "lucide-react";
import { whatsappLink } from "@/lib/site-settings";
import { getSiteSettings } from "@/lib/site-settings";
import { PaymentIcons } from "./PaymentIcons";

/**
 * Storefront footer — entirely driven by Site Settings (about text, link
 * columns, contact details, social links and copyright).
 * Add/remove/reorder any of it from /admin/settings.
 */
export async function Footer() {
  const settings = await getSiteSettings();
  const { brand, footer, contact, social, integrations } = settings;

  // WhatsApp sits alongside the social icons because, for a store whose traffic
  // arrives from Instagram and WhatsApp, it is a primary channel rather than an
  // afterthought. Every entry is dropped when its URL is blank, so the row
  // never shows an icon that leads nowhere.
  const socials = [
    { url: social.instagram, Icon: Instagram, label: "Instagram" },
    { url: whatsappLink(settings), Icon: MessageCircle, label: "WhatsApp" },
    { url: social.facebook, Icon: Facebook, label: "Facebook" },
    { url: social.youtube, Icon: Youtube, label: "YouTube" },
    { url: social.twitter, Icon: Twitter, label: "Twitter / X" },
    { url: social.linkedin, Icon: Linkedin, label: "LinkedIn" },
  ];

  const copyright = (footer.copyrightText || "").replace("{year}", String(new Date().getFullYear()));
  const supportEmail = contact.supportEmail || contact.email;
  const hasBlogLink = footer.columns.some((column) => column.links.some((link) => link.href === "/blog"));
  const helpColumnIndex = footer.columns.findIndex((column) => column.title.toLowerCase() === "help");
  const blogColumnIndex = helpColumnIndex >= 0 ? helpColumnIndex : 0;
  const footerColumns = footer.columns.map((column, index) => ({
    ...column,
    links: !hasBlogLink && index === blogColumnIndex
      ? [...column.links, { label: "Blog", href: "/blog" }]
      : column.links,
  }));

  return (
    <footer className="mt-8 border-t border-line bg-surface-alt sm:mt-16">
      <div className="mx-auto max-w-page px-4 py-5 sm:px-6 sm:py-11">
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 text-left sm:gap-8 lg:grid-cols-5">
          {/* Brand / about / social */}
          <div className="col-span-2 space-y-2 text-center sm:space-y-3 sm:text-left lg:col-span-2">
            <p className="font-display text-lg font-semibold tracking-[0.18em] text-heading sm:text-xl sm:tracking-[0.2em]">
              {brand.storeName.toUpperCase()}
            </p>
            {footer.about && <p className="mx-auto max-w-md text-xs leading-relaxed text-body sm:mx-0 sm:max-w-sm sm:text-sm">{footer.about}</p>}

            <div className="flex justify-center gap-1 sm:justify-start sm:gap-2">
              {socials.map(({ url, Icon, label }) => {
                const icon = <Icon size={15} />;
                const classes =
                  "inline-flex h-7 w-7 items-center justify-center rounded-full border border-line bg-background text-muted transition-all sm:h-9 sm:w-9";

                return url ? (
                  <a
                    key={label}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={label}
                    className={`${classes} hover:-translate-y-0.5 hover:border-primary hover:text-heading hover:shadow-sm`}
                  >
                    {icon}
                  </a>
                ) : (
                  <span
                    key={label}
                    aria-label={`${label} profile not configured`}
                    title={`${label} profile can be added in Admin Settings`}
                    className={`${classes} cursor-default opacity-40`}
                  >
                    {icon}
                  </span>
                );
              })}
            </div>

            {integrations.whatsappCatalogUrl && (
              <a
                href={integrations.whatsappCatalogUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-xs text-link underline-offset-4 hover:underline sm:text-sm"
              >
                Browse our WhatsApp catalogue →
              </a>
            )}
          </div>

          {/* Link columns */}
          {footerColumns.map((col, i) => (
            <div key={i} className="contents">
              <details className="group col-span-2 border-t border-line sm:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between py-2.5 font-display text-sm font-semibold text-heading [&::-webkit-details-marker]:hidden">
                  {col.title}
                  <ChevronDown size={15} className="transition-transform group-open:rotate-180" />
                </summary>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-2 pb-3 text-[11px] text-body">
                  {col.links.map((lnk, j) => (
                    <li key={j}>
                      <Link href={lnk.href || "#"} className="transition-colors hover:text-heading">
                        {lnk.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>

              <div className="hidden min-w-0 sm:block">
                {col.title && <p className="eyebrow mb-3">{col.title}</p>}
                <ul className="space-y-2 text-sm">
                  {col.links.map((lnk, j) => (
                    <li key={j}>
                      <Link href={lnk.href || "#"} className="text-body transition-colors hover:text-heading">
                        {lnk.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* Contact + payment methods */}
        <div className="mt-4 grid gap-4 border-t border-line pt-4 text-left sm:mt-10 sm:gap-8 sm:pt-8 md:grid-cols-2">
          {(supportEmail || contact.phone || contact.address || contact.businessHours) && (
            <div>
              <p className="eyebrow mb-1.5 sm:mb-3">Get in touch</p>
              <ul className="space-y-1 text-[11px] text-body sm:space-y-2 sm:text-sm">
                {supportEmail && (
                  <li className="flex items-center gap-2">
                    <Mail size={14} className="shrink-0 text-muted" />
                    <a href={`mailto:${supportEmail}`} className="hover:text-heading">
                      {supportEmail}
                    </a>
                  </li>
                )}
                {contact.phone && (
                  <li className="flex items-center gap-2">
                    <Phone size={14} className="shrink-0 text-muted" />
                    <a href={`tel:${contact.phone}`} className="hover:text-heading">
                      {contact.phone}
                    </a>
                  </li>
                )}
                {contact.businessHours && (
                  <li className="flex items-center gap-2">
                    <Clock size={14} className="shrink-0 text-muted" />
                    {contact.businessHours}
                  </li>
                )}
                {contact.address && (
                  <li className="flex items-start gap-2">
                    <MapPin size={14} className="mt-0.5 shrink-0 text-muted" />
                    {contact.address}
                  </li>
                )}
              </ul>
            </div>
          )}

          <PaymentIcons />
        </div>
      </div>

      {copyright && (
        <div className="border-t border-line">
          <div className="mx-auto flex max-w-page items-center justify-between gap-3 px-4 py-2.5 text-left text-[9px] text-muted sm:px-6 sm:py-3.5 sm:text-xs">
            <span>{copyright}</span>
            <span className="flex gap-4">
              <Link href="/pages/privacy-policy" className="hover:text-heading">
                Privacy
              </Link>
              <Link href="/pages/terms-of-service" className="hover:text-heading">
                Terms
              </Link>
            </span>
          </div>
        </div>
      )}
    </footer>
  );
}
