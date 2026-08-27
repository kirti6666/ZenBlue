/**
 * SEO helpers shared by pages, the sitemap and the JSON-LD emitters.
 */

/**
 * Serialises a JSON-LD object for embedding in a <script> tag.
 *
 * JSON.stringify does NOT escape "<", so any string in the graph containing
 * "</script>" — a product title, a store description, an FAQ answer — would
 * terminate the script element early and let the remainder execute as HTML.
 * Escaping the three characters that can start a tag or a comment closes that
 * off while keeping the output valid JSON.
 */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

/**
 * The site's public origin, with no trailing slash.
 *
 * Resolution order matters: an explicitly configured URL always wins, then
 * Vercel's injected host, then localhost for dev. Canonicals and JSON-LD are
 * absolute URLs, so getting this wrong silently poisons every canonical tag —
 * hence one helper rather than inline `process.env` reads.
 */
export function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

/** Absolute URL for a site-relative path. */
export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * BreadcrumbList JSON-LD. Pass the trail without the home crumb — it is
 * prepended here so every breadcrumb on the site starts consistently.
 */
export function breadcrumbSchema(trail: { name: string; path: string }[]) {
  const items = [{ name: "Home", path: "/" }, ...trail];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/** Product JSON-LD, including offer availability and any aggregate rating. */
export function productSchema(opts: {
  name: string;
  description: string;
  images: string[];
  slug: string;
  sku?: string;
  brand: string;
  price: number;
  currency: string;
  inStock: boolean;
  ratingValue?: number;
  ratingCount?: number;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: opts.name,
    description: opts.description,
    image: opts.images,
    ...(opts.sku ? { sku: opts.sku } : {}),
    brand: { "@type": "Brand", name: opts.brand },
    offers: {
      "@type": "Offer",
      url: absoluteUrl(`/product/${opts.slug}`),
      priceCurrency: opts.currency,
      price: opts.price,
      availability: opts.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
    ...(opts.ratingCount && opts.ratingCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: opts.ratingValue,
            reviewCount: opts.ratingCount,
          },
        }
      : {}),
  };
}

/** FAQPage JSON-LD, so the FAQ page can win a rich result. */
export function faqSchema(entries: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map((e) => ({
      "@type": "Question",
      name: e.question,
      acceptedAnswer: { "@type": "Answer", text: e.answer },
    })),
  };
}
