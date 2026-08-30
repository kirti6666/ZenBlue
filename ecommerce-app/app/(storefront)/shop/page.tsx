import { connectDB } from "@/lib/db";
import type { Metadata } from "next";
import Script from "next/script";
import { Product, Category } from "@/models";
import { ProductCard } from "@/components/storefront/ProductCard";
import { ShopFilters } from "@/components/storefront/ShopFilters";
import { getSiteSettings } from "@/lib/site-settings";
import { absoluteUrl, breadcrumbSchema, jsonLd } from "@/lib/seo";
import { applyCatalogueFilters, getProductFacets } from "@/lib/product-filters";

interface ShopPageProps {
  searchParams: {
    category?: string;
    search?: string;
    sort?: string;
    page?: string;
    fabric?: string;
    colour?: string;
    size?: string;
    inStock?: string;
  };
}

const PAGE_SIZE = 12;

export const dynamic = "force-dynamic";

export function generateMetadata({ searchParams }: ShopPageProps): Metadata {
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const hasFilter = Boolean(searchParams.category || searchParams.search || searchParams.sort || searchParams.fabric || searchParams.colour || searchParams.size || searchParams.inStock);
  const canonical = `/shop${page > 1 && !hasFilter ? `?page=${page}` : ""}`;
  const title = "Shop Premium Menswear";
  const description = "Shop ZenBlue premium menswear, including T-shirts, shirts, polos, streetwear and everyday essentials. Designed in India for modern comfort and lasting style.";
  return {
    title,
    description,
    alternates: { canonical },
    robots: hasFilter ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: { title, description, url: absoluteUrl(canonical) },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  await connectDB();
  const { commerce } = await getSiteSettings();
  const currency = commerce.currencySymbol;

  const page = Math.max(1, Number(searchParams.page ?? 1));
  const filter: Record<string, unknown> = { isActive: true };

  if (searchParams.category) {
    const cat = await Category.findOne({ slug: searchParams.category }).lean();
    if (cat) filter.category = (cat as { _id: unknown })._id;
  }
  if (searchParams.search) {
    filter.$text = { $search: searchParams.search };
  }
  const facetBase: Record<string, unknown> = { isActive: true };
  if (filter.category) facetBase.category = filter.category;
  applyCatalogueFilters(filter, searchParams);

  const sortMap: Record<string, Record<string, 1 | -1>> = {
    newest: { createdAt: -1 },
    price_asc: { price: 1 },
    price_desc: { price: -1 },
  };
  const sort = sortMap[searchParams.sort ?? "newest"] ?? sortMap.newest;

  const [products, total, categories, facets] = await Promise.all([
    Product.find(filter)
      .populate("category", "name slug")
      .sort(sort)
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    Product.countDocuments(filter),
    Category.find({ isActive: true }).sort({ name: 1 }).lean(),
    getProductFacets(facetBase),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const schemas = [
    breadcrumbSchema([{ name: "Shop", path: "/shop" }]),
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "ZenBlue Menswear",
      url: absoluteUrl("/shop"),
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

  function buildPageUrl(n: number) {
    const params = new URLSearchParams();
    if (searchParams.category) params.set("category", searchParams.category);
    if (searchParams.search) params.set("search", searchParams.search);
    for (const key of ["sort", "fabric", "colour", "size", "inStock"] as const) {
      if (searchParams[key]) params.set(key, searchParams[key]!);
    }
    params.set("page", String(n));
    return `/shop?${params.toString()}`;
  }

  return (
    <main className="mx-auto max-w-page px-4 py-4 sm:px-6 sm:py-8">
      <Script id="shop-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schemas) }} />
      <div className="mb-3 flex items-end justify-between border-b border-line pb-2.5 sm:mb-4">
        <h1 className="font-display text-xl font-semibold text-heading sm:text-2xl">Shop</h1>
        <span className="text-[11px] text-muted sm:text-xs">{total} products</span>
      </div>

      <ShopFilters
        categories={JSON.parse(JSON.stringify(categories))}
        currentCategory={searchParams.category}
        currentSearch={searchParams.search}
        currentSort={searchParams.sort}
        currentFabric={searchParams.fabric}
        currentColour={searchParams.colour}
        currentSize={searchParams.size}
        inStock={searchParams.inStock === "1"}
        fabrics={facets.fabrics}
        colours={facets.colours}
        sizes={facets.sizes}
      />

      {products.length === 0 ? (
        <p className="mt-10 text-center text-gray-400">No products found.</p>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-7 sm:mt-7 sm:gap-x-4 sm:gap-y-8 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p, index) => (
              <ProductCard key={String(p._id)} product={JSON.parse(JSON.stringify(p))} currency={currency} priority={page === 1 && index < 4} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-10">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <a
                  key={n}
                  href={buildPageUrl(n)}
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
