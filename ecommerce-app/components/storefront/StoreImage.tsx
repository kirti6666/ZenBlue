import { cloudinaryUrl, cloudinarySrcSet, IMAGE_SIZES } from "@/lib/image";

/**
 * Storefront image.
 *
 * A plain <img> with Cloudinary transformations rather than next/image, chosen
 * deliberately: Cloudinary already does format negotiation, compression and
 * resizing at the CDN edge, so routing the same work through Next's optimiser
 * adds a second hop and a serverless invocation per image for no visual gain.
 * Everything next/image gives us that matters here — srcset, sizes, lazy
 * loading, and a reserved box that prevents layout shift — is set explicitly.
 */
export function StoreImage({
  src,
  alt,
  width,
  sizes = IMAGE_SIZES.productCard,
  className = "",
  priority = false,
  aspect,
}: {
  src?: string;
  alt: string;
  /** The largest rendered width, used for the fallback `src`. */
  width?: number;
  sizes?: string;
  className?: string;
  /** Set on above-the-fold images so the LCP candidate is not lazy-loaded. */
  priority?: boolean;
  /** e.g. "4/5" — reserves the box so the page does not jump as images arrive. */
  aspect?: string;
}) {
  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-surface-alt text-xs text-muted ${className}`}
        style={aspect ? { aspectRatio: aspect } : undefined}
        aria-hidden="true"
      >
        No image
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={cloudinaryUrl(src, { width: width ?? 800, quality: priority ? "auto" : "auto:eco" })}
      srcSet={cloudinarySrcSet(src, undefined, { quality: priority ? "auto" : "auto:eco" })}
      sizes={sizes}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "low"}
      decoding="async"
      className={className}
      style={aspect ? { aspectRatio: aspect } : undefined}
    />
  );
}
