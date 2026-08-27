import { Star } from "lucide-react";
import type { Testimonial } from "@/lib/site-settings";

/**
 * Customer quotes strip.
 *
 * On phones, cards form a native horizontal scroll-snap rail: each review
 * remains a readable vertical card and the next card peeks into view to make
 * the swipe interaction obvious. Larger screens retain the three-column grid.
 */
export function Testimonials({
  heading,
  items,
}: {
  heading: string;
  items: Testimonial[];
}) {
  if (!items || items.length === 0) return null;

  return (
    <section className="border-y border-line bg-surface-alt">
      <div className="mx-auto max-w-page px-4 py-7 sm:px-6 sm:py-14">
        <h2 className="mb-4 text-center font-display text-lg font-semibold text-heading sm:mb-8 sm:text-2xl md:text-3xl">
          {heading}
        </h2>

        <div className="-mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain scroll-smooth px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:gap-4 sm:px-6 md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0 md:pb-0 [&::-webkit-scrollbar]:hidden">
          {items.slice(0, 3).map((t, i) => (
            <figure
              key={i}
              className="flex min-h-[190px] w-[72vw] max-w-[300px] shrink-0 snap-center flex-col justify-between rounded-xl border border-line bg-surface p-4 text-center sm:min-h-[230px] sm:w-[70vw] sm:max-w-[360px] sm:p-6 md:min-h-0 md:w-auto md:max-w-none md:snap-none md:text-left"
            >
              <div>
              <div className="mb-2 flex justify-center gap-0.5 sm:mb-3 md:justify-start" aria-label={`${t.rating} out of 5 stars`}>
                {Array.from({ length: 5 }, (_, s) => (
                  <Star
                    key={s}
                    size={12}
                    aria-hidden="true"
                    className={s < t.rating ? "fill-warning text-warning" : "text-line"}
                  />
                ))}
              </div>
              <blockquote className="text-[13px] leading-relaxed text-body sm:text-sm">“{t.quote}”</blockquote>
              </div>
              <figcaption className="mt-3 flex items-center justify-center gap-2 border-t border-line pt-3 sm:mt-4 sm:gap-2.5 sm:pt-4 md:justify-start">
                {t.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.avatar} alt="" className="h-7 w-7 rounded-full object-cover sm:h-8 sm:w-8" />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-alt text-[10px] font-semibold text-muted sm:h-8 sm:w-8 sm:text-xs">
                    {t.author.charAt(0)}
                  </span>
                )}
                <span className="text-[11px] sm:text-xs">
                  <span className="block font-medium text-heading">{t.author}</span>
                  {t.location && <span className="block text-muted">{t.location}</span>}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
