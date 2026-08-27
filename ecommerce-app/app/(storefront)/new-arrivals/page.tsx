import type { Metadata } from "next";
import Link from "next/link";
import { connectDB } from "@/lib/db";
import { Product } from "@/models";
import { getSiteSettings } from "@/lib/site-settings";
import { PageHeader } from "@/components/storefront/PageHeader";
import { ProductCard } from "@/components/storefront/ProductCard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New Arrivals",
  description:
    "The latest ZenBlue drops — new t-shirts, polos and streetwear, freshly added to the collection.",
  alternates: { canonical: "/new-arrivals" },
};

const PAGE_SIZE = 24;

/**
 * New Arrivals.
 *
 * Sorted by `publishedAt` rather than `createdAt` on purpose: a product may be
 * drafted weeks before it goes live, and the shop owner can back- or
 * forward-date a drop from the product form. `createdAt` would order the page
 * by when someone happened to type it in.
 */
export default async function NewArrivalsPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  await connectDB();
  const page = Math.max(1, Number(searchParams.page ?? 1));

  const [settings, products, total] = await Promise.all([
    getSiteSettings(),
    Product.find({ isActive: true, publishedAt: { $lte: new Date() } })
      .populate("category", "name slug")
      .sort({ publishedAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    Product.countDocuments({ isActive: true, publishedAt: { $lte: new Date() } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currency = settings.commerce.currencySymbol;

  return (
    <main>
      <PageHeader
        title={settings.home.newArrivalsHeading}
        subtitle="Everything we have added most recently, newest first."
        breadcrumbs={[{ name: "New Arrivals", path: "/new-arrivals" }]}
      />

      <div className="mx-auto max-w-page px-5 py-8 sm:px-6 sm:py-12">
        {products.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm text-muted">Nothing new just yet — check back shortly.</p>
            <Link
              href="/shop"
              className="mt-4 inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
            >
              Browse the full collection
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-4 sm:gap-y-8 md:grid-cols-3 lg:grid-cols-4">
              {(products as any[]).map((p, i) => (
                <ProductCard
                  key={String(p._id)}
                  product={JSON.parse(JSON.stringify(p))}
                  currency={currency}
                  // First row is above the fold — don't lazy-load the LCP image.
                  priority={i < 4}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-2">
                {page > 1 && (
                  <Link
                    href={`/new-arrivals?page=${page - 1}`}
                    className="rounded-lg border border-line px-4 py-2 text-sm text-heading hover:border-primary"
                  >
                    Previous
                  </Link>
                )}
                <span className="px-3 text-sm text-muted">
                  Page {page} of {totalPages}
                </span>
                {page < totalPages && (
                  <Link
                    href={`/new-arrivals?page=${page + 1}`}
                    className="rounded-lg border border-line px-4 py-2 text-sm text-heading hover:border-primary"
                  >
                    Next
                  </Link>
                )}
              </nav>
            )}
          </>
        )}
      </div>
    </main>
  );
}
