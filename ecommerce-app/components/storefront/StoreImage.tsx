import Image from "next/image";
import { cloudinaryPlaceholder, cloudinaryUrl, IMAGE_SIZES } from "@/lib/image";

/**
 * Storefront image.
 *
 * Cloudinary supplies the source asset while Next Image chooses the rendered
 * width, compresses it, caches the result and keeps a blur placeholder visible
 * through the skeleton-to-content handoff.
 */
export function StoreImage({
  src,
  alt,
  width,
  sizes = IMAGE_SIZES.productCard,
  className = "",
  wrapperClassName = "",
  priority = false,
  aspect,
}: {
  src?: string;
  alt: string;
  /** The largest rendered width, used for the fallback `src`. */
  width?: number;
  sizes?: string;
  className?: string;
  wrapperClassName?: string;
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

  const source = cloudinaryUrl(src, { width: width ?? 1200, quality: "auto:best" });
  const nextOptimizable = source.startsWith("/") || source.includes("res.cloudinary.com");
  const canBlur = src.includes("res.cloudinary.com");

  return (
    <span className={`relative block h-full w-full overflow-hidden bg-surface-alt ${wrapperClassName}`} style={aspect ? { aspectRatio: aspect } : undefined}>
      <Image
        src={source}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        quality={priority ? 80 : 72}
        unoptimized={!nextOptimizable}
        placeholder={canBlur ? "blur" : "empty"}
        blurDataURL={canBlur ? cloudinaryPlaceholder(src) : undefined}
        className={className}
      />
    </span>
  );
}
