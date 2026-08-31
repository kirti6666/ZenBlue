import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Script from "next/script";
import { connectDB } from "@/lib/db";
import { ContentPage } from "@/models";
import { PageHeader } from "@/components/storefront/PageHeader";
import { RichText } from "@/components/storefront/RichText";
import { breadcrumbSchema, jsonLd } from "@/lib/seo";
import { DEFAULT_CONTENT_PAGES } from "@/lib/content-defaults";
import { RETURN_WINDOW_POLICY_PARAGRAPH } from "@/lib/return-policy";

export const dynamic = "force-dynamic";

const LEGACY_SHIPPING_COPY =
  "Applicable shipping charges are shown at checkout before you place your order. ZEN BLUE may offer free-shipping promotions subject to the terms of the applicable offer.";
const FREE_SHIPPING_COPY =
  "ZEN BLUE provides free standard shipping on every website order. No minimum order value is required, and checkout will show the shipping charge as Free.";

/**
 * Generic CMS page — Shipping Policy, Return & Exchange, Privacy, Terms, and
 * anything else the client adds later at /admin/content.
 *
 * Falls back to the built-in copy in lib/content-defaults.ts when the database
 * has no row for a system slug yet. That guarantees the footer's policy links
 * work on a fresh deploy, before anyone has opened the admin.
 */
async function loadPage(slug: string) {
  await connectDB();
  const doc = await ContentPage.findOne({ slug, isPublished: true }).lean();
  if (doc) {
    const page = doc as any;
    if (slug === "return-exchange-policy") {
      const legacy =
        "Requests must be raised within the return or exchange period displayed on the product page or at the time of purchase. Requests submitted after the applicable period may not be accepted.";
      const body = String(page.body ?? "").replace(legacy, RETURN_WINDOW_POLICY_PARAGRAPH);
      if (body !== page.body) {
        await ContentPage.updateOne({ _id: page._id, body: page.body }, { $set: { body } });
        page.body = body;
      }
    }
    if (slug === "shipping-policy") {
      const body = String(page.body ?? "")
        .replace("## 3. Shipping charges", "## 3. Free shipping")
        .replace(LEGACY_SHIPPING_COPY, FREE_SHIPPING_COPY);
      if (body !== page.body) {
        await ContentPage.updateOne({ _id: page._id, body: page.body }, { $set: { body } });
        page.body = body;
      }
    }
    return page;
  }
  return DEFAULT_CONTENT_PAGES.find((p) => p.slug === slug) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const page = await loadPage(params.slug);
  if (!page) return { title: "Page not found" };

  return {
    title: page.metaTitle || page.title,
    description: page.metaDescription || page.subtitle || undefined,
    alternates: { canonical: `/pages/${params.slug}` },
    openGraph: {
      title: page.metaTitle || page.title,
      description: page.metaDescription || page.subtitle || undefined,
    },
  };
}

export default async function ContentPageView({ params }: { params: { slug: string } }) {
  const page = await loadPage(params.slug);
  if (!page) notFound();

  const crumbs = breadcrumbSchema([{ name: page.title, path: `/pages/${params.slug}` }]);

  return (
    <main>
      <Script
        id={`breadcrumb-${params.slug}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(crumbs) }}
      />
      <PageHeader
        title={page.title}
        subtitle={page.subtitle}
        breadcrumbs={[{ name: page.title, path: `/pages/${params.slug}` }]}
        compact
      />
      <article className="mx-auto max-w-[760px] px-4 py-5 sm:px-6 sm:py-8">
        <RichText content={page.body} compact />
        {page.updatedAt && (
          <p className="mt-8 border-t border-line pt-4 text-[11px] text-muted sm:text-xs">
            Last updated{" "}
            {new Date(page.updatedAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        )}
      </article>
    </main>
  );
}
