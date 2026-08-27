"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Truck, RotateCcw, ShieldCheck } from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import { useCurrency } from "@/lib/useCurrency";
import { WishlistButton } from "./WishlistButton";
import { SizeChartModal } from "./SizeChartModal";
import { BackInStockForm } from "./BackInStockForm";
import { ProductSpecs } from "./ProductSpecs";
import type { SizeChart } from "@/lib/site-settings";
import { normalizeMedia, type MediaItem } from "@/lib/media";
import { ProductGallery } from "./ProductGallery";
import { swatchColor } from "@/lib/color-swatches";

interface VariantAttribute {
  name: string;
  options: string[];
}

interface VariantCombination {
  combination: Record<string, string>;
  sku?: string;
  stock: number;
  price?: number;
  image?: string;
}

interface Product {
  _id: string;
  title: string;
  slug: string;
  description: string;
  images: string[];
  price: number;
  discountPrice?: number;
  stock: number;
  variants: VariantAttribute[];
  variantCombinations: VariantCombination[];
  category?: { name: string } | null;
  fabric?: string;
  fitType?: string;
  careInstructions?: string;
  videoUrl?: string;
  media?: MediaItem[];
  backInStockEnabled?: boolean;
  ratingsAverage?: number;
  ratingsCount?: number;
}

/** Canonical variant key — must match lib/inventory.ts so stock lookups agree. */
function variantKeyOf(variant: Record<string, string>): string {
  return Object.keys(variant)
    .sort()
    .map((k) => `${k}:${variant[k]}`)
    .join(" / ");
}

export function ProductDetailClient({
  product,
  sizeChart,
  estimatedDelivery,
  returnPolicy,
  freeShippingThreshold,
}: {
  product: Product;
  sizeChart?: SizeChart | null;
  estimatedDelivery: string;
  returnPolicy: string;
  freeShippingThreshold: number;
}) {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const hasVariants = product.variants.length > 0;
  const { symbol: currency } = useCurrency();

  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    product.variants.forEach((v) => {
      initial[v.name] = v.options[0];
    });
    return initial;
  });

  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const matchedCombination = useMemo(() => {
    if (!hasVariants) return null;
    return (
      product.variantCombinations.find((c) =>
        product.variants.every((v) => c.combination[v.name] === selected[v.name])
      ) ?? null
    );
  }, [selected, hasVariants, product]);

  /**
   * Stock for every option of a given attribute, holding the other selections
   * fixed. This is what lets a sold-out size be struck through in the picker
   * instead of the shopper discovering it only after selecting.
   */
  const optionStock = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    if (!hasVariants) return map;

    for (const attr of product.variants) {
      map[attr.name] = {};
      for (const option of attr.options) {
        const probe = { ...selected, [attr.name]: option };
        const combo = product.variantCombinations.find((c) =>
          product.variants.every((v) => c.combination[v.name] === probe[v.name])
        );
        map[attr.name][option] = combo?.stock ?? 0;
      }
    }
    return map;
  }, [selected, hasVariants, product]);

  const displayPrice = matchedCombination?.price ?? product.discountPrice ?? product.price;
  const isDiscounted = !matchedCombination?.price && Boolean(product.discountPrice);
  const stock = hasVariants ? (matchedCombination?.stock ?? 0) : product.stock;
  const outOfStock = stock <= 0;
  const lowStock = !outOfStock && stock <= 5;

  const discountPercent = isDiscounted
    ? Math.round(((product.price - displayPrice) / product.price) * 100)
    : 0;

  // A variant with its own photograph leads the gallery, so selecting "Olive"
  // shows the olive garment rather than leaving the shopper on the navy one.
  const galleryMedia = useMemo<MediaItem[]>(() => {
    const base = normalizeMedia(product);
    if (!matchedCombination?.image) return base;
    const variantShot: MediaItem = { type: "image", url: matchedCombination.image };
    return [variantShot, ...base.filter((m) => m.url !== matchedCombination.image)];
  }, [product, matchedCombination]);

  const selectedLabel = hasVariants ? Object.values(selected).join(" · ") : "";
  const stockMessage = outOfStock
    ? "Sold out"
    : lowStock
      ? `Only ${stock} left in this size`
      : "In stock, ready to ship";

  function handleAddToCart() {
    if (hasVariants && !matchedCombination) return;

    addItem({
      productId: product._id,
      title: product.title,
      slug: product.slug,
      price: displayPrice,
      image: galleryMedia.find((m) => m.type === "image")?.url,
      quantity,
      variant: hasVariants ? selected : undefined,
      maxStock: stock,
    });

    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 md:gap-10 lg:gap-14">
      {/* ---- Gallery ---- */}
      <ProductGallery
        media={galleryMedia}
        title={product.title}
        saleBadge={isDiscounted ? `−${discountPercent}%` : undefined}
      />

      {/* ---- Buy box ---- */}
      <div className="text-left">
        {product.category?.name && <p className="eyebrow mb-1.5 sm:mb-2">{product.category.name}</p>}
        <h1 className="font-display text-xl font-semibold leading-tight text-heading sm:text-3xl">
          {product.title}
        </h1>

        {(product.ratingsCount ?? 0) > 0 && (
          <p className="mt-1.5 text-xs text-muted sm:mt-2 sm:text-sm">
            <span className="text-warning">★</span>{" "}
            <span className="text-heading">{product.ratingsAverage?.toFixed(1)}</span> ·{" "}
            {product.ratingsCount} review{product.ratingsCount === 1 ? "" : "s"}
          </p>
        )}

        <div className="mt-2 flex items-baseline gap-2.5 sm:mt-4 sm:gap-3">
          <span className="font-sans text-xl font-semibold tabular-nums text-heading sm:text-2xl">
            {currency}
            {displayPrice}
          </span>
          {isDiscounted && (
            <span className="font-sans text-base tabular-nums text-muted line-through">
              {currency}
              {product.price}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted">Inclusive of all taxes</p>

        {/* Variant pickers */}
        {hasVariants &&
          product.variants.map((v) => {
            const isSizeAttr = /size/i.test(v.name);
            const isColorAttr = /colou?r/i.test(v.name);
            return (
              <div key={v.name} className="mt-4 sm:mt-6">
                <div className="mb-2 flex items-center justify-between gap-2 sm:mb-2.5">
                  <p className="text-sm font-medium text-heading">
                    {v.name}:{" "}
                    <span className="font-normal text-muted">{selected[v.name]}</span>
                  </p>
                  {isSizeAttr && sizeChart && <SizeChartModal chart={sizeChart} />}
                </div>

                <div className="flex flex-nowrap gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] md:flex-wrap md:overflow-visible md:pb-0 [&::-webkit-scrollbar]:hidden">
                  {v.options.map((opt) => {
                    const isSelected = selected[v.name] === opt;
                    const optStock = optionStock[v.name]?.[opt] ?? 0;
                    const unavailable = optStock <= 0;

                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setSelected((prev) => ({ ...prev, [v.name]: opt }))}
                        aria-pressed={isSelected}
                        title={unavailable ? `${opt} — sold out` : opt}
                        aria-label={isColorAttr ? `${opt}${isSelected ? ", selected" : ""}` : undefined}
                        className={`relative shrink-0 border transition-all ${
                          isColorAttr
                            ? `h-8 w-8 rounded-full p-0 sm:h-9 sm:w-9 ${
                                isSelected
                                  ? "border-background shadow-sm ring-2 ring-heading ring-offset-2 ring-offset-background"
                                  : "border-black/20 hover:border-heading/50 hover:ring-2 hover:ring-heading/15"
                              }`
                            : `rounded-md px-3 py-1.5 text-sm sm:px-3.5 sm:py-2 ${
                                isSelected
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : unavailable
                                    ? "border-line text-muted"
                                    : "border-line text-heading hover:border-primary"
                              }`
                        }`}
                        style={isColorAttr ? { backgroundColor: swatchColor(opt) } : undefined}
                      >
                        {isColorAttr ? <span className="sr-only">{opt}</span> : opt}
                        {/* Sold-out options stay selectable so the shopper can
                            reach the back-in-stock form for that exact variant. */}
                        {unavailable && !isSelected && (
                          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                            <span className="h-px w-[85%] rotate-[-14deg] bg-muted/70" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

        {/* Quantity + add to cart, or the restock capture */}
        {outOfStock ? (
          <div className="mt-3 sm:mt-5">
            <p className="mb-3 text-xs text-error sm:text-sm">{stockMessage}</p>
            {product.backInStockEnabled !== false ? (
              <BackInStockForm
                productId={product._id}
                variantKey={hasVariants ? variantKeyOf(selected) : ""}
                variantLabel={selectedLabel}
              />
            ) : (
              <p className="rounded-lg bg-surface-alt p-4 text-sm text-muted">
                This piece is no longer available.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className={`mt-3 flex items-center gap-3 sm:mt-5 md:block ${lowStock ? "justify-between" : "justify-start"}`}>
              {lowStock && (
                <p className="text-xs text-warning sm:text-sm">{stockMessage}</p>
              )}
              <div className="flex items-center gap-1.5 md:mt-5 md:justify-start md:gap-2">
                <span className="text-xs font-medium text-heading sm:text-sm">Qty</span>
                <div className="flex h-8 items-center rounded-md border border-line sm:h-10 sm:rounded-lg">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                  className="flex h-8 w-8 items-center justify-center text-base text-heading disabled:opacity-40 sm:h-10 sm:w-10 sm:text-lg"
                  disabled={quantity <= 1}
                >
                  −
                </button>
                <span className="min-w-6 text-center font-sans text-xs tabular-nums text-heading sm:min-w-8 sm:text-sm">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(stock, q + 1))}
                  aria-label="Increase quantity"
                  className="flex h-8 w-8 items-center justify-center text-base text-heading disabled:opacity-40 sm:h-10 sm:w-10 sm:text-lg"
                  disabled={quantity >= stock}
                >
                  +
                </button>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-row gap-2.5 sm:mt-5 sm:gap-3">
              <button
                type="button"
                onClick={handleAddToCart}
                className="flex-1 rounded-lg bg-primary px-2 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 sm:py-3.5"
              >
                {added ? "Added to cart ✓" : "Add to cart"}
              </button>
              <WishlistButton
                productId={product._id}
                variant="inline"
                className="flex-1 justify-center px-2 sm:px-4"
              />
            </div>

            {added && (
              <button
                type="button"
                onClick={() => router.push("/cart")}
                className="mt-2.5 w-full rounded-lg border border-line py-3 text-sm font-medium text-heading hover:border-primary"
              >
                View cart &amp; checkout
              </button>
            )}

          </>
        )}

        {/* Service promises */}
        <ul className="mt-5 space-y-2 border-t border-line pt-4 text-xs text-body sm:mt-6 sm:space-y-2.5 sm:pt-5 sm:text-sm">
          <li className="flex items-center justify-start gap-2.5">
            <Truck size={15} className="shrink-0 text-muted" />
            {estimatedDelivery} · free over {currency}
            {freeShippingThreshold}
          </li>
          <li className="flex items-center justify-start gap-2.5">
            <RotateCcw size={15} className="shrink-0 text-muted" />
            Easy returns and exchanges with free reverse pickup
          </li>
          <li className="flex items-center justify-start gap-2.5">
            <ShieldCheck size={15} className="shrink-0 text-muted" />
            Secure payments — UPI, cards, netbanking, wallets
          </li>
        </ul>

        <ProductSpecs
          description={product.description}
          fabric={product.fabric}
          fitType={product.fitType}
          careInstructions={product.careInstructions}
          estimatedDelivery={estimatedDelivery}
          returnPolicy={returnPolicy}
        />
      </div>
    </div>
  );
}
