import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import { connectDB } from "@/lib/db";
import { Faq } from "@/models";
import { PageHeader } from "@/components/storefront/PageHeader";
import { FaqAccordion } from "@/components/storefront/FaqAccordion";
import { faqSchema, jsonLd } from "@/lib/seo";
import { DEFAULT_FAQS } from "@/lib/content-defaults";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description:
    "Answers on ZenBlue orders, shipping, returns and exchanges, sizing, fabric care and payments.",
  alternates: { canonical: "/faq" },
};

/**
 * FAQ page, grouped by category.
 *
 * Falls back to the built-in entries when nothing has been published in the
 * admin yet, so the page is never empty on a fresh deploy. FAQPage JSON-LD is
 * emitted from whichever set is actually rendered.
 */
export default async function FaqPage() {
  await connectDB();
  const stored = await Faq.find({ isPublished: true }).sort({ category: 1, sortOrder: 1 }).lean();
  const entries = stored.length > 0 ? (stored as any[]) : DEFAULT_FAQS;

  // Preserve first-seen category order rather than sorting alphabetically —
  // "Orders" should lead, not "Payments".
  const grouped = entries.reduce<Record<string, typeof entries>>((acc, entry) => {
    const key = entry.category || "General";
    (acc[key] ??= []).push(entry);
    return acc;
  }, {});

  return (
    <main>
      <Script
        id="faq-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(faqSchema(entries.map((e) => ({ question: e.question, answer: e.answer })))),
        }}
      />

      <PageHeader
        title="Frequently asked questions"
        subtitle="Orders, shipping, returns, sizing and payments — answered."
        breadcrumbs={[{ name: "FAQ", path: "/faq" }]}
        compact
      />

      <div className="mx-auto max-w-[760px] px-4 py-5 sm:px-6 sm:py-8">
        {Object.entries(grouped).map(([category, items]) => (
          <section key={category} className="mb-7 sm:mb-8">
            <h2 className="mb-3 font-display text-lg text-heading sm:text-xl">{category}</h2>
            <FaqAccordion
              items={items.map((i) => ({ question: i.question, answer: i.answer }))}
            />
          </section>
        ))}

        <div className="border-t border-line px-2 pt-6 text-center sm:pt-8">
          <p className="text-sm font-medium text-heading">Still need a hand?</p>
          <p className="mt-1 text-sm text-muted">
            Our team replies within one working day.
          </p>
          <Link
            href="/contact"
            className="mt-4 inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Contact us
          </Link>
        </div>
      </div>
    </main>
  );
}
