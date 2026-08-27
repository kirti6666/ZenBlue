/**
 * Cloudinary transformation helpers.
 *
 * The quotation commits to automatic compression, WebP/AVIF conversion,
 * responsive sizing, lazy loading and CDN delivery. Cloudinary already does all
 * of that — but only if the URL asks for it. A raw upload URL serves the
 * original 4MB JPEG to a phone on 4G, which is exactly what the LCP budget
 * cannot afford.
 *
 * `f_auto` picks AVIF or WebP per browser, `q_auto` picks a quality level per
 * image content, and `c_fill,w_…` resizes on the CDN so the bytes on the wire
 * match the slot the image is rendered into.
 */

const CLOUDINARY_UPLOAD_MARKER = "/image/upload/";

export interface TransformOptions {
  width?: number;
  height?: number;
  /** How the image fills its box. "fill" crops, "fit" letterboxes. */
  crop?: "fill" | "fit" | "limit";
  quality?: "auto" | "auto:best" | "auto:eco" | number;
  /** Bias the crop toward faces or the visually interesting region. */
  gravity?: "auto" | "face" | "center";
  blur?: number;
}

/**
 * Rewrites a Cloudinary URL to include transformations.
 *
 * Any non-Cloudinary URL is returned untouched, so a client who pastes an
 * external image link still gets a working (if unoptimised) image rather than a
 * broken one.
 */
export function cloudinaryUrl(url: string, opts: TransformOptions = {}): string {
  if (!url || !url.includes(CLOUDINARY_UPLOAD_MARKER)) return url;

  const parts: string[] = ["f_auto", `q_${opts.quality ?? "auto"}`];

  if (opts.width) parts.push(`w_${Math.round(opts.width)}`);
  if (opts.height) parts.push(`h_${Math.round(opts.height)}`);
  if (opts.width || opts.height) {
    parts.push(`c_${opts.crop ?? "fill"}`);
    parts.push(`g_${opts.gravity ?? "auto"}`);
  }
  if (opts.blur) parts.push(`e_blur:${opts.blur}`);

  // Do not stack transformations if the URL already carries some — a second
  // f_auto/q_auto chain is wasted work and can conflict with a deliberate one.
  const [base, rest] = url.split(CLOUDINARY_UPLOAD_MARKER);
  if (/^(f_|q_|w_|h_|c_|g_|e_)/.test(rest)) return url;

  return `${base}${CLOUDINARY_UPLOAD_MARKER}${parts.join(",")}/${rest}`;
}

/**
 * Builds a `srcset` so the browser downloads the size it actually needs.
 * A 400px-wide card on a phone should not fetch the 1200px desktop render.
 */
export function cloudinarySrcSet(
  url: string,
  widths: number[] = [320, 480, 640, 960, 1280],
  opts: Omit<TransformOptions, "width"> = {}
): string | undefined {
  if (!url || !url.includes(CLOUDINARY_UPLOAD_MARKER)) return undefined;
  return widths.map((w) => `${cloudinaryUrl(url, { ...opts, width: w })} ${w}w`).join(", ");
}

/** Tiny, heavily blurred version used as a placeholder while the real one loads. */
export function cloudinaryPlaceholder(url: string): string {
  return cloudinaryUrl(url, { width: 24, quality: "auto:eco", blur: 400 });
}

/** Common `sizes` values, so call sites do not each invent their own. */
export const IMAGE_SIZES = {
  /** 2-up on mobile, 3-up on tablet, 4-up on desktop. */
  productCard: "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw",
  /** Half the page on desktop, full width below. */
  productDetail: "(max-width: 768px) 100vw, 50vw",
  /** Always full-bleed. */
  hero: "100vw",
  thumbnail: "80px",
} as const;
