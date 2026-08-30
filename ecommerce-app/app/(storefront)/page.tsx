import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { connectDB } from "@/lib/db";
import { Product, Category } from "@/models";
import { getSiteSettings } from "@/lib/site-settings";
import { HeroSlider } from "@/components/storefront/HeroSlider";
import { CategoryCircles } from "@/components/storefront/CategoryCircles";
import { ProductRail } from "@/components/storefront/ProductRail";
import { ShopTheLook } from "@/components/storefront/ShopTheLook";
import { Testimonials } from "@/components/storefront/Testimonials";
import { InstagramStrip } from "@/components/storefront/InstagramStrip";
import { PRODUCT_CARD_FIELDS } from "@/lib/catalogue-select";

export const dynamic = "force-dynamic";

/**
 * ZenBlue homepage.
 *
 * Section order follows the quotation: hero, category tiles, featured, new
 * arrivals, best sellers, testimonials, Instagram. Every heading, banner and
 * quote comes from Site Settings, and each rail hides itself when its query is
 * empty — so the page composes correctly on a store with two products or two
 * hundred.
 *
 * All catalogue reads run in one Promise.all: four small indexed queries in
 * parallel cost roughly one round trip, where awaiting them in sequence would
 * cost four.
 */
export default async function HomePage() {
  await connectDB();

  const [settings, featured, newArrivals, bestSellers, categories] = await Promise.all([
    getSiteSettings(),
    Product.find({ isActive: true, isFeatured: true })
      .select(PRODUCT_CARD_FIELDS)
      .slice("images", 2)
      .populate("category", "name slug")
      .sort({ publishedAt: -1 })
      .limit(8)
      .lean(),
    Product.find({ isActive: true, publishedAt: { $lte: new Date() } })
      .select(PRODUCT_CARD_FIELDS)
      .slice("images", 2)
      .populate("category", "name slug")
      .sort({ publishedAt: -1 })
      .limit(8)
      .lean(),
    Product.find({ isActive: true, salesCount: { $gt: 0 } })
      .select(PRODUCT_CARD_FIELDS)
      .slice("images", 2)
      .populate("category", "name slug")
      .sort({ salesCount: -1 })
      .limit(8)
      .lean(),
    // Sub-categories are included: the circular strip is a shortcut to a kind
    // of garment ("Kurta Set", "Sherwani"), which is exactly what a
    // sub-category is — restricting it to top-level parents would leave a
    // three-item row.
    Category.find({ isActive: true }).sort({ name: 1 }).limit(14).lean(),
  ]);

  const { home, commerce, integrations } = settings;
  const currency = commerce.currencySymbol;
  const plain = (docs: unknown) => JSON.parse(JSON.stringify(docs));

  return (
    <main>
      <HeroSlider slides={home.heroSlides} fallback={home.hero} />

      {/* Shop-by-category shortcuts, immediately under the hero */}
      <CategoryCircles
        heading={home.categoriesHeading}
        categories={(categories as any[]).map((c) => ({
          _id: String(c._id),
          name: c.name,
          slug: c.slug,
          image: c.image,
        }))}
      />

      <ProductRail
        heading={home.featuredHeading}
        href="/shop"
        products={plain(featured)}
        currency={currency}
      />

      <ShopTheLook
        reels={integrations.reelVideos}
      />

      {/* Editorial banners */}
      {home.banners.length > 0 && (
        <section className="mx-auto max-w-page px-5 py-5 sm:px-6 sm:py-6">
          <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
            {home.banners.map((b, i) => {
              // A lone banner (or an odd count) gets the full-width treatment
              // so rows never end with a dangling half-width card.
              const wide = i === 0 && home.banners.length % 2 === 1;
              const inner = (
                <div
                  className={`group relative overflow-hidden rounded-2xl ${
                    wide ? "aspect-[16/6] md:col-span-2" : "aspect-[16/9]"
                  }`}
                >
                  {b.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={b.image}
                      alt={b.heading}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-brand to-primary" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-8">
                    {b.heading && (
                      <h3 className="font-display text-2xl font-semibold text-white md:text-3xl">
                        {b.heading}
                      </h3>
                    )}
                    {b.subheading && (
                      <p className="mt-1 max-w-md text-sm text-white/80">{b.subheading}</p>
                    )}
                    {b.link && (
                      <span className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-medium text-brand transition-all group-hover:gap-2.5">
                        Shop now
                        <ArrowRight size={15} />
                      </span>
                    )}
                  </div>
                </div>
              );
              return b.link ? (
                <Link key={i} href={b.link}>
                  {inner}
                </Link>
              ) : (
                <div key={i}>{inner}</div>
              );
            })}
          </div>
        </section>
      )}

      {home.showNewArrivals && (
        <ProductRail
          heading={home.newArrivalsHeading}
          eyebrow="Just landed"
          href="/new-arrivals"
          products={plain(newArrivals)}
          currency={currency}
        />
      )}

      {home.showBestSellers && (
        <ProductRail
          heading={home.bestSellersHeading}
          eyebrow="Most wanted"
          href="/shop?sort=popular"
          products={plain(bestSellers)}
          currency={currency}
        />
      )}

      <Testimonials heading={home.testimonialsHeading} items={home.testimonials} />

      <InstagramStrip
        heading={home.instagramHeading}
        handle={integrations.instagramHandle}
        posts={integrations.instagramPosts}
        profileUrl={settings.social.instagram}
      />
    </main>
  );
}
