import Link from "next/link";
import { getPalette } from "@/lib/theme";

/**
 * ZenBlue wordmark.
 *
 * Two assets are held, and the ground decides which one renders: the supplied
 * The supplied mark is navy-on-ivory for light header grounds.
 * `PaletteTokens.dark` is the single source of truth for which is correct, so
 * switching colour direction in the admin swaps the logo automatically instead
 * of leaving an invisible one behind.
 *
 * Both are replaceable at Admin → Settings → Branding.
 */
export function Logo({
  storeName,
  logoUrl,
  logoDarkUrl,
  palette,
  className = "",
}: {
  storeName: string;
  logoUrl?: string;
  logoDarkUrl?: string;
  palette?: string;
  className?: string;
}) {
  const onDarkGround = getPalette(palette).dark;
  const src = onDarkGround ? logoDarkUrl || logoUrl : logoUrl;
  const usesOriginalSquareMark = src === "/branding/zenblue-logo.jpeg";
  const usesIvoryWideMark = src === "/branding/zenblue-logo-ivory.png";

  return (
    <Link href="/" aria-label={storeName} className={`inline-flex items-center ${className}`}>
      {src && usesIvoryWideMark ? (
        <span className="relative block h-6 w-[108px] overflow-hidden sm:h-8 sm:w-[150px] lg:h-9 lg:w-[170px]">
          {/* The source file remains untouched; this viewport removes only its
              generous export margins and preserves its matching ivory ground. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={storeName}
            className="absolute left-[-38px] top-[-20px] w-[190px] max-w-none sm:left-[-54px] sm:top-[-29px] sm:w-[268px] lg:left-[-60px] lg:top-[-32px] lg:w-[300px]"
          />
        </span>
      ) : src && usesOriginalSquareMark ? (
        <span className="relative block h-7 w-[132px] overflow-hidden sm:h-8 sm:w-[150px] lg:h-9 lg:w-[170px]">
          {/* Keep the supplied JPEG unchanged on disk. This viewport removes
              only its large white margins in the header. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={storeName}
            className="absolute left-[-6px] top-[-59px] w-[160px] max-w-none sm:left-[-8px] sm:top-[-67px] sm:w-[182px] lg:left-[-10px] lg:top-[-76px] lg:w-[205px]"
          />
        </span>
      ) : src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={storeName}
          // Fixed height with auto width keeps any uploaded aspect ratio intact,
          // and stepping the height up at sm avoids a cramped mobile header.
          // Height steps with the breakpoint; width stays auto so an uploaded
          // logo of any aspect ratio is never distorted.
          className="h-6 w-auto object-contain sm:h-7 lg:h-8"
        />
      ) : (
        <span className="whitespace-nowrap font-display text-lg font-semibold tracking-[0.2em] text-heading sm:text-xl lg:text-2xl">
          {storeName.toUpperCase()}
        </span>
      )}
    </Link>
  );
}
