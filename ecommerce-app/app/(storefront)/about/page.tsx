import type { Metadata } from "next";
import Link from "next/link";
import { connectDB } from "@/lib/db";
import { ContentPage } from "@/models";
import { getSiteSettings } from "@/lib/site-settings";
import { PageHeader } from "@/components/storefront/PageHeader";
import { RichText } from "@/components/storefront/RichText";
import { DEFAULT_CONTENT_PAGES } from "@/lib/content-defaults";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const page = await loadAbout();
  return {
    title: page.metaTitle || page.title,
    description: page.metaDescription,
    alternates: { canonical: "/about" },
  };
}

async function loadAbout() {
  await connectDB();
  const doc = await ContentPage.findOne({ slug: "about", isPublished: true }).lean();
  return (doc as any) ?? DEFAULT_CONTENT_PAGES.find((p) => p.slug === "about")!;
}

/**
 * About Us. The body is CMS-editable like any other content page; the stats
 * strip and closing call to action are part of the page's design rather than
 * the copy, so they live here.
 */
export default async function AboutPage() {
  const [page, settings] = await Promise.all([loadAbout(), getSiteSettings()]);

  const stats = [
    { value: "240 GSM", label: "Combed cotton, bio-washed" },
    { value: "7 days", label: "Free returns and exchanges" },
    { value: "24 hrs", label: "Dispatch on working days" },
    { value: "100%", label: "Made in India" },
  ];

  return (
    <main>
      <PageHeader
        title={page.title}
        subtitle={page.subtitle}
        breadcrumbs={[{ name: "About", path: "/about" }]}
        compact
      />

      <section className="mx-auto max-w-[760px] px-4 py-5 sm:px-6 sm:py-8">
        <RichText content={page.body} compact />
      </section>

      <section className="border-y border-line">
        <div className="mx-auto grid max-w-page gap-5 px-4 py-7 sm:grid-cols-2 sm:gap-7 sm:px-6 sm:py-9 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="font-display text-3xl font-semibold text-heading">{s.value}</p>
              <p className="mt-1 text-sm text-muted">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-page px-4 py-8 text-center sm:px-6 sm:py-10">
        <h2 className="font-display text-2xl font-semibold text-heading">
          Start with a piece you will actually wear.
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-body">{settings.brand.tagline}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/shop"
            className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Shop the collection
          </Link>
          <Link
            href="/contact"
            className="rounded-lg border border-line px-6 py-3 text-sm font-medium text-heading transition-colors hover:border-primary"
          >
            Talk to us
          </Link>
        </div>
      </section>
    </main>
  );
}
