import Link from "next/link";
import { WishlistButton } from "./WishlistButton";
import { formatPrice } from "@/lib/site-settings";
import { cloudinaryUrl, cloudinarySrcSet, IMAGE_SIZES } from "@/lib/image";
import { isVideoUrl } from "@/lib/media";
import { swatchColor } from "@/lib/color-swatches";

interface ProductCardProps {
  product: {
    _id: string;
    title: string;
    slug: string;
    price: number;
    discountPrice?: number;
    images: string[];
    category?: { name: string } | null;
    ratingsAverage?: number;
    ratingsCount?: number;
    stock?: number;
    variants?: { name: string; options: string[] }[];
    variantCombinations?: { stock: number }[];
    publishedAt?: string | Date;
  };
  /** Currency symbol from Site Settings; defaults to ₹ so existing call sites keep working. */
  currency?: string;
  /** Set on the first row of a listing so the LCP image is not lazy-loaded. */
  priority?: boolean;
}

/** Anything published inside this window carries a "New" flag. */
const NEW_ARRIVAL_DAYS = 21;

export function ProductCard({ product, currency = "₹", priority = false }: ProductCardProps) {
  const hasDiscount = Boolean(product.discountPrice && product.discountPrice < product.price);
  const effectivePrice = hasDiscount ? product.discountPrice! : product.price;
  const discountPercent = hasDiscount
    ? Math.round(((product.price - product.discountPrice!) / product.price) * 100)
    : 0;

  const totalStock = product.variantCombinations?.length
    ? product.variantCombinations.reduce((s, c) => s + (c.stock ?? 0), 0)
    : (product.stock ?? 0);
  const soldOut = totalStock <= 0;
  const lowStock = !soldOut && totalStock <= 5;

  const isNew =
    !!product.publishedAt &&
    Date.now() - new Date(product.publishedAt).getTime() < NEW_ARRIVAL_DAYS * 864e5;

  // `images` can carry video URLs (a product gallery accepts both), and a
  // <video> src in an <img> renders as a broken image — so the card only ever
  // considers stills.
  const stills = (product.images ?? []).filter((url) => url && !isVideoUrl(url));
  const primary = stills[0];
  // The second still is revealed on hover — on a clothing card that is almost
  // always the back or a detail shot, which answers the question a shopper
  // would otherwise open the product page to ask.
  const secondary = stills[1];
  const colors =
    product.variants?.find((variant) => /colou?r/i.test(variant.name))?.options.filter(Boolean) ?? [];

  return (
    <Link href={`/product/${product.slug}`} className="group block text-left">
      <div className="relative mb-2.5 aspect-[4/5] overflow-hidden rounded-lg bg-surface-alt sm:mb-3">
        <WishlistButton productId={product._id} className="absolute right-2 top-2 z-10" />

        {/* One badge at a time: sold out outranks a sale, a sale outranks new. */}
        {soldOut ? (
          <span className="absolute left-2 top-2 z-10 rounded bg-surface/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
            Sold out
          </span>
        ) : hasDiscount ? (
          <span className="absolute left-2 top-2 z-10 rounded bg-sale px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
            −{discountPercent}%
          </span>
        ) : isNew ? (
          <span className="absolute left-2 top-2 z-10 rounded bg-brand px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
            New
          </span>
        ) : null}

        {primary ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cloudinaryUrl(primary, { width: 600 })}
              srcSet={cloudinarySrcSet(primary, [240, 320, 480, 640])}
              sizes={IMAGE_SIZES.productCard}
              alt={product.title}
              loading={priority ? "eager" : "lazy"}
              // fetchPriority high on the first row helps the listing's LCP.
              fetchPriority={priority ? "high" : "auto"}
              decoding="async"
              className={`h-full w-full object-cover transition-all duration-500 group-hover:scale-[1.04] ${
                secondary ? "group-hover:opacity-0" : ""
              } ${soldOut ? "opacity-60" : ""}`}
            />

            {secondary && (
              // Stacked underneath and faded in, rather than swapping the src:
              // changing src would show the card's background for however long
              // the second image takes to decode. This way the swap is
              // instant once loaded, and never flashes empty.
              //
              // Always lazy, never fetchPriority — the hover image must not
              // compete with the visible one for bandwidth.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cloudinaryUrl(secondary, { width: 600 })}
                srcSet={cloudinarySrcSet(secondary, [240, 320, 480, 640])}
                sizes={IMAGE_SIZES.productCard}
                alt=""
                aria-hidden="true"
                loading="lazy"
                decoding="async"
                className={`pointer-events-none absolute inset-0 h-full w-full object-cover opacity-0 transition-all duration-500 group-hover:scale-[1.04] group-hover:opacity-100 ${
                  soldOut ? "group-hover:opacity-60" : ""
                }`}
              />
            )}
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted">
            No image
          </div>
        )}
      </div>

      <h3 className="line-clamp-2 min-h-[2.25rem] font-display text-base font-semibold leading-[1.1] text-heading transition-colors group-hover:text-link sm:min-h-[2.5rem] sm:text-lg">
        {product.title}
      </h3>

      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-sans text-[13px] font-normal leading-none tabular-nums text-heading sm:text-sm">
          {formatPrice(effectivePrice, currency)}
        </span>
        {hasDiscount && (
          <span className="font-sans text-xs tabular-nums text-muted line-through sm:text-sm">{formatPrice(product.price, currency)}</span>
        )}
      </div>

      {colors.length > 0 && (
        <div
          className="mt-2 flex items-center gap-1.5"
          role="list"
          aria-label={`Available colours: ${colors.join(", ")}`}
        >
          {colors.slice(0, 4).map((color) => (
            <span
              key={color}
              role="listitem"
              title={color}
              aria-label={color}
              className="h-3.5 w-3.5 rounded-sm border border-black/15 ring-1 ring-inset ring-white/40"
              style={{ backgroundColor: swatchColor(color) }}
            />
          ))}
          {colors.length > 4 && (
            <span className="ml-0.5 text-[11px] leading-none text-muted">+{colors.length - 4}</span>
          )}
        </div>
      )}

      {lowStock && (
        <p className="mt-1.5 text-[11px] font-medium text-warning">
          Only {totalStock} left
        </p>
      )}
    </Link>
  );
}
