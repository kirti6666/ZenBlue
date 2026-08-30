import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Script from "next/script";
import { connectDB } from "@/lib/db";
import { Product, Category } from "@/models";
import { ProductCard } from "@/components/storefront/ProductCard";
import { getSiteSettings } from "@/lib/site-settings";
import { InferSchemaType } from "mongoose";
import { ICategory } from "@/models/Category";
import { absoluteUrl, breadcrumbSchema, jsonLd } from "@/lib/seo";
import { ShopFilters } from "@/components/storefront/ShopFilters";
import { applyCatalogueFilters, getProductFacets } from "@/lib/product-filters";

interface CategoryPageProps {
  params: { slug: string };
  searchParams: { page?: string; sort?: string; fabric?: string; colour?: string; size?: string; inStock?: string };
}

type CategoryType = InferSchemaType<typeof Category>;


const PAGE_SIZE = 12;

export const dynamic = "force-dynamic";

export async function generateMetadata({ params, searchParams }: CategoryPageProps): Promise<Metadata> {
  await connectDB();
  const category = await Category.findOne({ slug: params.slug, isActive: true }).select("name slug image").lean<any>();
  if (!category) return { title: "Collection not found", robots: { index: false, follow: false } };
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const title = `${category.name} for Men`;
  const description = `Shop ${category.name.toLowerCase()} from ZenBlue. Premium quality, modern fits and dependable everyday style with delivery across India.`;
  const hasFilter = Boolean(searchParams.sort || searchParams.fabric || searchParams.colour || searchParams.size || searchParams.inStock);
  const canonical = `/category/${category.slug}${page > 1 && !hasFilter ? `?page=${page}` : ""}`;
  return {
    title,
    description,
    alternates: { canonical },
    robots: hasFilter ? { index: false, follow: true } : undefined,
    openGraph: { title, description, url: absoluteUrl(canonical), images: category.image ? [category.image] : undefined },
    twitter: { card: "summary_large_image", title, description, images: category.image ? [category.image] : undefined },
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  await connectDB();
  const { commerce } = await getSiteSettings();
  const currency = commerce.currencySymbol;

  const category = await Category.findOne({ slug: params.slug, isActive: true }).lean<ICategory>();
  if (!category) notFound();

  const categoryId = (category as { _id: unknown })._id;
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const baseFilter: Record<string, unknown> = { category: categoryId, isActive: true };
  const filter = applyCatalogueFilters({ ...baseFilter }, searchParams);
  const sortMap: Record<string, Record<string, 1 | -1>> = { newest: { createdAt: -1 }, price_asc: { price: 1 }, price_desc: { price: -1 } };
  const sort = sortMap[searchParams.sort ?? "newest"] ?? sortMap.newest;

  const [products, total, facets] = await Promise.all([
    Product.find(filter)
      .populate("category", "name slug")
      .sort(sort)
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    Product.countDocuments(filter),
    getProductFacets(baseFilter),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const categoryName = (category as { name: string }).name;
  const schemas = [
    breadcrumbSchema([{ name: categoryName, path: `/category/${params.slug}` }]),
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: categoryName,
      url: absoluteUrl(`/category/${params.slug}`),
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: total,
        itemListElement: products.map((product: any, index) => ({
          "@type": "ListItem",
          position: (page - 1) * PAGE_SIZE + index + 1,
          url: absoluteUrl(`/product/${product.slug}`),
          name: product.title,
        })),
      },
    },
  ];

  return (
    <main className="mx-auto max-w-page px-5 py-8 sm:px-6 sm:py-10">
      <Script id="category-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schemas) }} />
      <h1 className="mb-6 text-center text-2xl font-bold sm:text-left">{categoryName}</h1>

      <ShopFilters categories={[]} showCategory={false} currentSort={searchParams.sort} currentFabric={searchParams.fabric} currentColour={searchParams.colour} currentSize={searchParams.size} inStock={searchParams.inStock === "1"} fabrics={facets.fabrics} colours={facets.colours} sizes={facets.sizes} />

      {products.length === 0 ? (
        <p className="text-center text-gray-400">No products in this category yet.</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-4 sm:gap-y-8 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p, index) => (
              <ProductCard key={String(p._id)} product={JSON.parse(JSON.stringify(p))} currency={currency} priority={index < 4} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-10">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <a
                  key={n}
                  href={`/category/${params.slug}?${new URLSearchParams({ ...(searchParams.sort ? { sort: searchParams.sort } : {}), ...(searchParams.fabric ? { fabric: searchParams.fabric } : {}), ...(searchParams.colour ? { colour: searchParams.colour } : {}), ...(searchParams.size ? { size: searchParams.size } : {}), ...(searchParams.inStock ? { inStock: searchParams.inStock } : {}), page: String(n) }).toString()}`}
                  className={`px-3 py-1 rounded-md border text-sm ${n === page ? "bg-primary text-primary-foreground" : ""
                    }`}
                >
                  {n}
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
