import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { connectDB } from "@/lib/db";
import { Product } from "@/models";
import { ProductDetailClient } from "@/components/storefront/ProductDetailClient";
import { ProductCard } from "@/components/storefront/ProductCard";
import { ProductReviews } from "@/components/storefront/ProductReviews";
import { getSiteSettings, findSizeChart } from "@/lib/site-settings";
import { breadcrumbSchema, productSchema, absoluteUrl, jsonLd } from "@/lib/seo";
import { totalStock } from "@/lib/inventory";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  await connectDB();
  const p = await Product.findOne({ slug: params.slug, isActive: true })
    .select("title description images metaTitle metaDescription")
    .lean<{
      title: string;
      description: string;
      images: string[];
      metaTitle?: string;
      metaDescription?: string;
    }>();

  if (!p) return { title: "Product not found" };

  const title = p.metaTitle || p.title;
  const description = p.metaDescription || p.description?.slice(0, 160);

  return {
    title,
    description,
    alternates: { canonical: `/product/${params.slug}` },
    openGraph: {
      type: "website",
      title,
      description,
      url: absoluteUrl(`/product/${params.slug}`),
      images: p.images?.[0] ? [p.images[0]] : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: p.images?.[0] ? [p.images[0]] : [],
    },
  };
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  await connectDB();

  const [product, settings] = await Promise.all([
    Product.findOne({ slug: params.slug, isActive: true })
      .populate("category", "name slug")
      .lean<any>(),
    getSiteSettings(),
  ]);

  if (!product) notFound();

  const category = product.category;
  const related = category?._id
    ? await Product.find({
        category: category._id,
        _id: { $ne: product._id },
        isActive: true,
      })
        .populate("category", "name slug")
        .limit(4)
        .lean()
    : [];

  const currency = settings.commerce.currencySymbol;
  const sizeChart = findSizeChart(settings, product.sizeChartKey);
  const effectivePrice =
    product.discountPrice && product.discountPrice < product.price
      ? product.discountPrice
      : product.price;

  // Product + Breadcrumb JSON-LD, emitted together so search engines can tie
  // the offer to its place in the catalogue.
  const schemas = [
    productSchema({
      name: product.title,
      description: product.description,
      images: product.images ?? [],
      slug: product.slug,
      sku: product.sku,
      brand: settings.brand.storeName,
      price: effectivePrice,
      currency: settings.commerce.currencyCode,
      inStock: totalStock(product) > 0,
      ratingValue: product.ratingsAverage,
      ratingCount: product.ratingsCount,
    }),
    breadcrumbSchema(
      [
        { name: "Shop", path: "/shop" },
        ...(category ? [{ name: category.name, path: `/category/${category.slug}` }] : []),
        { name: product.title, path: `/product/${product.slug}` },
      ]
    ),
  ];

  return (
    <main className="mx-auto max-w-page px-5 py-6 sm:px-6 sm:py-8">
      <Script
        id="product-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(schemas) }}
      />

      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex flex-wrap items-center gap-1 text-xs text-muted">
          <li>
            <Link href="/" className="hover:text-heading">
              Home
            </Link>
          </li>
          <li className="flex items-center gap-1">
            <ChevronRight size={12} aria-hidden="true" />
            <Link href="/shop" className="hover:text-heading">
              Shop
            </Link>
          </li>
          {category && (
            <li className="flex items-center gap-1">
              <ChevronRight size={12} aria-hidden="true" />
              <Link href={`/category/${category.slug}`} className="hover:text-heading">
                {category.name}
              </Link>
            </li>
          )}
          <li className="flex items-center gap-1">
            <ChevronRight size={12} aria-hidden="true" />
            <span aria-current="page" className="text-heading">
              {product.title}
            </span>
          </li>
        </ol>
      </nav>

      <ProductDetailClient
        product={JSON.parse(JSON.stringify(product))}
        sizeChart={sizeChart}
        estimatedDelivery={settings.shipping.estimatedDeliveryDays}
        returnPolicy={settings.returns.policySummary}
        freeShippingThreshold={settings.commerce.freeShippingThreshold}
      />

      <ProductReviews productId={String(product._id)} />

      {related.length > 0 && (
        <section className="mt-16 border-t border-line pt-12">
          <h2 className="mb-5 font-display text-xl font-semibold text-heading sm:mb-7 sm:text-2xl">
            You might also like
          </h2>
          <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-4 sm:gap-y-8 md:grid-cols-4">
            {(related as any[]).map((p) => (
              <ProductCard
                key={String(p._id)}
                product={JSON.parse(JSON.stringify(p))}
                currency={currency}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
