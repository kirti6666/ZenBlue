import Link from "next/link";
import { Play } from "lucide-react";
import type { ReelVideo } from "@/lib/site-settings";

interface LookItem {
  mediaUrl: string;
  poster?: string;
  title: string;
  href: string;
}

/**
 * Short-form, portrait content rail placed beneath Featured products. It is
 * intentionally admin-driven: one card is rendered for each configured reel,
 * with no social/product placeholders filling unused positions.
 */
export function ShopTheLook({
  reels,
}: {
  reels: ReelVideo[];
}) {
  const configuredReels: LookItem[] = (reels ?? [])
    .filter((reel) => Boolean(reel.videoUrl))
    .map((reel) => ({
      mediaUrl: reel.videoUrl,
      poster: reel.poster || undefined,
      title: reel.title || "See the look",
      href: reel.link || "/shop",
    }));

  const looks = configuredReels
    .filter((look, index, all) => all.findIndex((item) => item.mediaUrl === look.mediaUrl) === index)
    .slice(0, 5);

  if (looks.length === 0) return null;

  return (
    <section className="border-y border-line bg-surface py-7 sm:py-10 lg:py-12">
      <div className="mx-auto max-w-page">
        <div className="mb-4 px-4 text-center sm:mb-7 sm:px-6">
          <p className="eyebrow mb-1">Style in motion</p>
          <h2 className="font-display text-xl font-semibold text-heading sm:text-2xl md:text-3xl">
            Shop the Look
          </h2>
        </div>

        <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain px-4 pb-1 [scrollbar-width:none] sm:gap-4 sm:px-6 lg:justify-center lg:overflow-visible [&::-webkit-scrollbar]:hidden">
          {looks.map((look, index) => {
            const external = /^https?:\/\//i.test(look.href);
            const card = (
              <div className="group relative aspect-[9/16] overflow-hidden rounded-xl bg-brand">
                <video
                  src={look.mediaUrl}
                  poster={look.poster}
                  muted
                  loop
                  autoPlay
                  playsInline
                  preload={index === 0 ? "metadata" : "none"}
                  aria-label={look.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-black/10" />
                <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm">
                  <Play size={14} className="ml-0.5 fill-current" />
                </span>
                <div className="absolute inset-x-0 bottom-0 p-3.5 text-left text-white sm:p-4">
                  <p className="line-clamp-2 text-[13px] font-semibold leading-snug sm:text-sm">{look.title}</p>
                  <span className="mt-1 block text-[10px] uppercase tracking-[0.16em] text-white/75">
                    Shop now
                  </span>
                </div>
              </div>
            );

            const className = "w-[44vw] max-w-[190px] shrink-0 snap-center sm:w-[230px] sm:max-w-none lg:w-[220px] lg:snap-none";

            return external ? (
              <a key={`${look.mediaUrl}-${index}`} href={look.href} target="_blank" rel="noreferrer" className={className}>
                {card}
              </a>
            ) : (
              <Link key={`${look.mediaUrl}-${index}`} href={look.href} className={className}>
                {card}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
