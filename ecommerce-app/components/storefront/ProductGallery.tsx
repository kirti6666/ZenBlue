"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { cloudinaryUrl, cloudinarySrcSet, IMAGE_SIZES } from "@/lib/image";
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
  const current = media[active];

  if (!current) {
    return (
      <div className="flex aspect-[4/5] items-center justify-center rounded-xl bg-surface-alt text-sm text-muted">
        No image
      </div>
    );
  }

  return (
    <div>
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-surface-alt">
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
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cloudinaryUrl(current.url, { width: 900 })}
            srcSet={cloudinarySrcSet(current.url, [480, 640, 900, 1200])}
            sizes={IMAGE_SIZES.productDetail}
            alt={current.alt || title}
            // The gallery is the LCP element on this route.
            fetchPriority={active === 0 ? "high" : "auto"}
            className="h-full w-full object-cover"
          />
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
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cloudinaryUrl(poster, { width: 140 })}
                    alt=""
                    loading="lazy"
                    decoding="async"
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
