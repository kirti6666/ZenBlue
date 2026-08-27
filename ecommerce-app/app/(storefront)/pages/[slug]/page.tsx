import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Script from "next/script";
import { connectDB } from "@/lib/db";
import { ContentPage } from "@/models";
import { PageHeader } from "@/components/storefront/PageHeader";
import { RichText } from "@/components/storefront/RichText";
import { breadcrumbSchema, jsonLd } from "@/lib/seo";
import { DEFAULT_CONTENT_PAGES } from "@/lib/content-defaults";

export const dynamic = "force-dynamic";

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
  if (doc) return doc as any;
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
