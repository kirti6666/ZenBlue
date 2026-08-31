"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { cloudinaryPlaceholder, cloudinaryUrl, IMAGE_SIZES } from "@/lib/image";
import { videoPoster, type MediaItem } from "@/lib/media";

/**
 * Product gallery for a mixed list of images and videos.
 *
 * A video is never autoplayed here — on a product page the shopper is reading,
 * and a clip that starts itself competes with that. It gets a play affordance
 * and full controls, and only loads its bytes once selected (`preload="none"`).
 * Thumbnails for videos use a Cloudinary-derived poster frame, so the admin
 * does not have to upload a still for every clip.
 */
export function ProductGallery({
  media,
  title,
  saleBadge,
}: {
  media: MediaItem[];
  title: string;
  saleBadge?: string;
}) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef<number | null>(null);
  const current = media[active];

  function move(delta: number) {
    setActive((index) => (index + delta + media.length) % media.length);
  }

  useEffect(() => {
    if (media.length < 2 || paused || current?.type === "video") return;
    const timer = window.setInterval(() => {
      setActive((index) => {
        for (let step = 1; step <= media.length; step += 1) {
          const candidate = (index + step) % media.length;
          if (media[candidate]?.type === "image") return candidate;
        }
        return index;
      });
    }, 4500);
    return () => window.clearInterval(timer);
  }, [current?.type, media, paused]);

  if (!current) {
    return (
      <div className="flex aspect-[4/5] items-center justify-center rounded-xl bg-surface-alt text-sm text-muted">
        No image
      </div>
    );
  }
  const currentSource = current.type === "image" ? cloudinaryUrl(current.url, { width: 1600, quality: "auto:best" }) : "";
  const currentOptimizable = currentSource.startsWith("/") || currentSource.includes("res.cloudinary.com");

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)}>
      <div
        className="relative aspect-[4/5] touch-pan-y overflow-hidden rounded-xl bg-surface-alt"
        onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; setPaused(true); }}
        onTouchEnd={(event) => {
          const end = event.changedTouches[0]?.clientX;
          if (touchStart.current != null && end != null && Math.abs(end - touchStart.current) > 45) move(end < touchStart.current ? 1 : -1);
          touchStart.current = null;
          setPaused(false);
        }}
      >
        {current.type === "video" ? (
          <video
            key={current.url}
            src={current.url}
            poster={videoPoster(current)}
            controls
            playsInline
            preload="none"
            className="h-full w-full object-cover"
          />
        ) : (
          <Image
            key={current.url}
            src={currentSource}
            sizes={IMAGE_SIZES.productDetail}
            alt={current.alt || title}
            fill
            priority={active === 0}
            quality={82}
            unoptimized={!currentOptimizable}
            placeholder={current.url.includes("res.cloudinary.com") ? "blur" : "empty"}
            blurDataURL={current.url.includes("res.cloudinary.com") ? cloudinaryPlaceholder(current.url) : undefined}
            className="h-full w-full object-cover"
          />
        )}

        {media.length > 1 && (
          <>
            <button type="button" onClick={() => move(-1)} aria-label="Previous product image" className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/50 bg-surface/90 text-heading shadow-sm transition hover:bg-surface">
              <ChevronLeft size={19} />
            </button>
            <button type="button" onClick={() => move(1)} aria-label="Next product image" className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/50 bg-surface/90 text-heading shadow-sm transition hover:bg-surface">
              <ChevronRight size={19} />
            </button>
            <span className="absolute bottom-2.5 right-2.5 rounded-full bg-black/55 px-2 py-1 text-[10px] font-medium text-white">
              {active + 1} / {media.length}
            </span>
          </>
        )}

        {saleBadge && current.type === "image" && (
          <span className="absolute left-3 top-3 rounded bg-sale px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">
            {saleBadge}
          </span>
        )}
      </div>

      {media.length > 1 && (
        <div className="mt-3 flex flex-wrap justify-center gap-2 md:justify-start">
          {media.map((item, i) => {
            const poster = item.type === "video" ? videoPoster(item) : item.url;
            const posterSource = poster ? cloudinaryUrl(poster, { width: 240, quality: "auto:eco" }) : "";
            return (
              <button
                key={item.url + i}
                type="button"
                onClick={() => setActive(i)}
                aria-label={
                  item.type === "video" ? `Play video ${i + 1}` : `View image ${i + 1}`
                }
                aria-current={i === active}
                className={`relative h-16 w-14 overflow-hidden rounded-md border-2 transition-colors sm:h-20 sm:w-16 ${
                  i === active ? "border-primary" : "border-transparent hover:border-line"
                }`}
              >
                {poster ? (
                  <Image
                    src={posterSource}
                    alt=""
                    fill
                    sizes="80px"
                    quality={65}
                    unoptimized={!posterSource.startsWith("/") && !posterSource.includes("res.cloudinary.com")}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-surface-alt" />
                )}

                {item.type === "video" && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                    <Play size={14} fill="currentColor" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
