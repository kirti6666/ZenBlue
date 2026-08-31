"use client";

import Link from "next/link";
import { getImageProps } from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { Banner } from "@/lib/site-settings";
import { MAX_HERO_SLIDES } from "@/lib/site-settings-constants";
import { cloudinaryUrl } from "@/lib/image";

export { MAX_HERO_SLIDES };

const AUTOPLAY_MS = 6500;
/** Horizontal travel before a touch counts as a swipe rather than a tap. */
const SWIPE_THRESHOLD_PX = 50;

/**
 * Homepage hero.
 *
 * Supports up to 15 image or video slides, auto-advancing on a timer, with
 * three ways to navigate:
 *   - arrow buttons on tablet and desktop, where a pointer is available
 *   - horizontal swipe on touch devices
 *   - dot indicators on every size
 *
 * Autoplay pauses on hover, on keyboard focus, and while a finger is down; it
 * is skipped entirely under prefers-reduced-motion, where the slider becomes a
 * manually-driven carousel rather than a moving one. Video slides are replaced
 * by their poster image under the same preference.
 */
export function HeroSlider({
  slides,
  fallback,
}: {
  slides: Banner[];
  fallback: {
    title: string;
    subtitle: string;
    ctaText: string;
    ctaLink: string;
    backgroundImage: string;
    mobileBackgroundImage: string;
  };
}) {
  const items: Banner[] =
    slides.length > 0
      ? slides.slice(0, MAX_HERO_SLIDES)
      : [
          {
            image: fallback.backgroundImage,
            mobileImage: fallback.mobileBackgroundImage,
            heading: fallback.title,
            subheading: fallback.subtitle,
            link: fallback.ctaLink,
          },
        ];

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef(0);

  const count = items.length;
  const multiple = count > 1;

  const go = useCallback(
    (next: number) => {
      // Wrap in both directions so the arrows never dead-end.
      setIndex((prev) => {
        const target = (next + count) % count;
        return target === prev ? prev : target;
      });
    },
    [count]
  );

  const prev = useCallback(() => go(index - 1), [go, index]);
  const next = useCallback(() => go(index + 1), [go, index]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!multiple || paused || reducedMotion) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [multiple, paused, reducedMotion, count]);

  // Arrow keys move the carousel when it holds focus.
  function onKeyDown(e: React.KeyboardEvent) {
    if (!multiple) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      prev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      next();
    }
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
    setPaused(true);
  }

  function onTouchMove(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  }

  function onTouchEnd() {
    const delta = touchDeltaX.current;
    touchStartX.current = null;
    setPaused(false);

    if (!multiple || Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    // Swiping left advances, matching the direction of travel.
    if (delta < 0) next();
    else prev();
  }

  const active = items[index];
  const ctaLabel = slides.length > 0 ? "Shop now" : fallback.ctaText;

  return (
    <section
      className="relative isolate w-full overflow-hidden bg-surface-alt"
      aria-roledescription={multiple ? "carousel" : undefined}
      aria-label={multiple ? "Featured collections" : undefined}
      tabIndex={multiple ? 0 : -1}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Mobile uses its square artwork. Tablet and desktop use the separately
          managed wide artwork at its supplied 1950:810 proportion. */}
      <div className="relative mx-auto aspect-square w-full md:aspect-[1950/810]">
        {items.map((slide, i) => {
          const isActive = i === index;
          const showVideo = Boolean(slide.videoUrl) && !reducedMotion;
          const desktopSource = slide.image || slide.mobileImage || "";
          const mobileSource = slide.mobileImage || slide.image || "";
          const desktopImage = desktopSource
            ? getImageProps({
                src: cloudinaryUrl(desktopSource, { width: 2560, quality: "auto:best" }),
                alt: "",
                width: 1950,
                height: 810,
                sizes: "100vw",
                quality: 78,
                priority: i === 0,
              }).props
            : null;
          const mobileImage = mobileSource
            ? getImageProps({
                src: cloudinaryUrl(mobileSource, { width: 1280, quality: "auto:best" }),
                alt: "",
                width: 1024,
                height: 1024,
                sizes: "100vw",
                quality: 76,
                priority: i === 0,
              }).props
            : null;

          return (
            <div
              key={i}
              aria-hidden={!isActive}
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              className={`absolute inset-0 transition-opacity duration-700 ${
                isActive ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              {showVideo ? (
                <video
                  // Only the visible slide loads its file, so fifteen slides do
                  // not pull fifteen videos on first paint.
                  src={isActive ? slide.videoUrl : undefined}
                  poster={slide.image || undefined}
                  autoPlay={isActive}
                  muted
                  loop
                  playsInline
                  preload={i === 0 ? "auto" : "none"}
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full object-cover lg:object-[center_35%]"
                />
              ) : slide.image || slide.mobileImage ? (
                <>
                  <picture>
                    {mobileImage?.srcSet && <source media="(max-width: 767px)" srcSet={mobileImage.srcSet} />}
                    {desktopImage && <img {...desktopImage} className="absolute inset-0 h-full w-full object-cover" />}
                  </picture>
                </>
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-brand via-brand to-primary" />
              )}

              {/* Scrim only where there is text to keep legible. A banner
                  supplied with its headline already set into the artwork gets
                  no overlay at all — darkening it would be damaging finished
                  design work to make room for copy that is not there. */}
              {(slide.image || slide.videoUrl) && slide.heading && (
                <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-transparent" />
              )}
            </div>
          );
        })}

        {/* Copy sits over the stage rather than defining its height, so the
            3:2 box above stays exactly 3:2 whatever the headline length.

            A slide with no heading renders no overlay: the artwork carries its
            own typography (see the campaign banners), and a second headline on
            top of a designed one reads as a mistake. Leave Heading blank in
            Settings → Homepage to let a banner speak for itself. */}
        {active.heading && (
          <div className="absolute inset-0 mx-auto flex max-w-page items-center justify-center px-5 text-center sm:justify-start sm:px-6 sm:text-left lg:px-12">
            <div key={index} className="mx-auto max-w-xl animate-fade-up sm:mx-0">
              <p className="mb-2.5 text-[10px] uppercase tracking-[0.2em] text-white/75 sm:text-[11px]">
                Crafted for every moment
              </p>
              <h1 className="font-display text-3xl font-semibold uppercase leading-[1.08] tracking-wide text-white sm:text-4xl lg:text-6xl">
                {active.heading}
              </h1>
              <span className="mx-auto mt-4 block h-px w-12 bg-white/50 sm:mx-0" />
              {active.subheading && (
                <p className="mt-4 max-w-md text-sm leading-relaxed text-white/85 sm:text-[15px]">
                  {active.subheading}
                </p>
              )}
              <Link
                href={active.link || "/shop"}
                className="mt-7 inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-medium text-brand transition-all hover:gap-3 sm:mt-8 sm:px-7 sm:py-3.5"
              >
                {ctaLabel}
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        )}

        {/* A headline-free banner still has to be clickable. */}
        {!active.heading && (
          <Link
            href={active.link || "/shop"}
            aria-label={active.subheading || "Shop this collection"}
            className="absolute inset-0"
          />
        )}

        {/* Arrows — pointer devices only. On touch the swipe handles it, and
            arrows would just cover the artwork. */}
        {multiple && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Previous slide"
              className="absolute left-3 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full border border-white/35 bg-black/20 p-2.5 text-white backdrop-blur-sm transition-colors hover:bg-black/45 md:flex lg:left-5"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next slide"
              className="absolute right-3 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full border border-white/35 bg-black/20 p-2.5 text-white backdrop-blur-sm transition-colors hover:bg-black/45 md:flex lg:right-5"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>

      {/* Announces slide changes to screen readers without moving focus. */}
      <span aria-live="polite" className="sr-only">
        {multiple ? `Slide ${index + 1} of ${count}: ${active.heading}` : ""}
      </span>
    </section>
  );
}
