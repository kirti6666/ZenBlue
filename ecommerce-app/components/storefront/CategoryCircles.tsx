import Link from "next/link";
import Image from "next/image";
import { cloudinaryPlaceholder, cloudinaryUrl } from "@/lib/image";

export interface CategoryCircle {
  _id: string;
  name: string;
  slug: string;
  image?: string;
}

/**
 * Circular category shortcuts, sitting directly under the hero.
 *
 * A Server Component with no JavaScript: the strip is a native horizontal
 * scroller with scroll-snap, which on a phone is what a shopper's thumb
 * expects anyway and costs nothing to ship. `justify-center` only takes effect
 * once the row is narrower than the viewport, so a small catalogue centres and
 * a large one scrolls — without measuring anything at runtime.
 *
 * Each circle links to /category/<slug>, i.e. straight to that category's
 * products rather than to a filtered shop page, so the destination is
 * shareable and indexable.
 */
export function CategoryCircles({
  categories,
  heading,
}: {
  categories: CategoryCircle[];
  heading?: string;
}) {
  if (categories.length === 0) return null;

  return (
    <section className="border-b border-line bg-surface-alt">
      <div className="mx-auto max-w-page px-4 py-4 sm:px-6 sm:py-8">
        {heading && (
          <h2 className="mb-3 text-center font-display text-base font-semibold text-heading sm:mb-5 sm:text-xl">
            {heading}
          </h2>
        )}

        <ul className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain scroll-smooth px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:gap-6 sm:px-0 md:gap-8 lg:justify-center [&::-webkit-scrollbar]:hidden">
          {categories.map((cat) => (
            <li
              key={cat._id}
              className="relative isolate w-[calc((100vw-3.5rem)/4)] min-w-16 max-w-[76px] shrink-0 snap-start sm:w-[100px] sm:max-w-none md:w-[112px]"
            >
              <Link
                href={`/category/${cat.slug}`}
                className="group flex w-full flex-col items-center gap-1.5 sm:gap-2.5"
              >
                <span className="relative block aspect-square w-full overflow-hidden rounded-full bg-surface ring-1 ring-inset ring-line transition-[box-shadow] duration-300 group-hover:ring-2 group-hover:ring-primary">
                  {cat.image ? (
                    <Image
                      src={cloudinaryUrl(cat.image, { width: 320, quality: "auto:best" })}
                      sizes="(max-width: 640px) 19vw, 112px"
                      fill
                      alt={cat.name}
                      quality={75}
                      unoptimized={!cat.image.startsWith("/") && !cat.image.includes("res.cloudinary.com")}
                      placeholder={cat.image.includes("res.cloudinary.com") ? "blur" : "empty"}
                      blurDataURL={cat.image.includes("res.cloudinary.com") ? cloudinaryPlaceholder(cat.image) : undefined}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center font-display text-base text-muted sm:text-xl">
                      {cat.name.charAt(0)}
                    </span>
                  )}
                </span>
                <span className="line-clamp-2 min-h-[2.1em] text-center text-[10px] leading-[1.05] text-heading transition-colors group-hover:text-link sm:text-sm sm:leading-tight">
                  {cat.name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
