import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductCard } from "./ProductCard";

/**
 * A titled row of products with a "view all" link.
 *
 * Renders nothing when the query behind it came back empty, so a store that has
 * not marked anything as featured yet simply shows one fewer section rather
 * than an empty heading with white space under it.
 */
export function ProductRail({
  heading,
  href,
  products,
  currency,
  eyebrow,
  priority = false,
}: {
  heading: string;
  href?: string;
  products: any[];
  currency: string;
  eyebrow?: string;
  priority?: boolean;
}) {
  if (!products || products.length === 0) return null;

  return (
    <section className="mx-auto max-w-page px-4 py-7 sm:px-6 sm:py-14">
      <div className="mb-4 flex items-end justify-between gap-4 text-left sm:mb-7">
        <div>
          {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
          <h2 className="font-display text-xl font-semibold text-heading sm:text-2xl md:text-3xl">
            {heading}
          </h2>
        </div>
        {href && (
          <Link
            href={href}
            className="inline-flex shrink-0 items-center gap-1.5 font-display text-base font-semibold text-link transition-all hover:gap-2.5"
          >
            View all <ArrowRight size={14} />
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-4 sm:gap-y-8 md:grid-cols-3 lg:grid-cols-4">
        {products.map((p, i) => (
          <ProductCard
            key={String(p._id)}
            product={p}
            currency={currency}
            priority={priority && i < 4}
          />
        ))}
      </div>
    </section>
  );
}
