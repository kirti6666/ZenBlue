/**
 * Unified media handling for hero slides and product galleries.
 *
 * Both places accept images AND videos, so rather than adding a parallel
 * `videoUrl` field to every schema, media is modelled as a typed list. Legacy
 * `images: string[]` is still read through `normalizeMedia()`, so existing
 * products keep working untouched and only get converted when re-saved.
 */

export type MediaKind = "image" | "video";

export interface MediaItem {
  type: MediaKind;
  url: string;
  /** Video only: the still shown before playback and used for social previews. */
  poster?: string;
  /** Alt text for images; caption for videos. */
  alt?: string;
}

const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i;
/** Cloudinary serves video from a distinct delivery path. */
const CLOUDINARY_VIDEO_PATH = "/video/upload/";

/**
 * Decides whether a URL points at a video.
 *
 * Checks the Cloudinary delivery path first, because a Cloudinary video URL may
 * carry a transformation that changes the extension (an .mp4 requested as .webm)
 * while the delivery path stays authoritative.
 */
export function isVideoUrl(url: string): boolean {
  if (!url) return false;
  if (url.includes(CLOUDINARY_VIDEO_PATH)) return true;
  return VIDEO_EXTENSIONS.test(url);
}

export function mediaKind(url: string): MediaKind {
  return isVideoUrl(url) ? "video" : "image";
}

/**
 * Coerces any of the shapes we might hold into a clean MediaItem[]:
 *   - a modern `media` array
 *   - a legacy `images: string[]`
 *   - a legacy single `videoUrl`
 *
 * Videos are always ordered after images. A gallery that opens on a video
 * autoplays nothing and shows a black frame on slow connections, so the first
 * item should be a still.
 */
export function normalizeMedia(source: {
  media?: unknown;
  images?: unknown;
  videoUrl?: unknown;
}): MediaItem[] {
  const out: MediaItem[] = [];

  if (Array.isArray(source.media)) {
    for (const raw of source.media) {
      if (!raw) continue;
      if (typeof raw === "string") {
        out.push({ type: mediaKind(raw), url: raw });
      } else if (typeof raw === "object" && "url" in raw) {
        const item = raw as MediaItem;
        if (!item.url) continue;
        out.push({
          type: item.type === "video" || isVideoUrl(item.url) ? "video" : "image",
          url: item.url,
          poster: item.poster || undefined,
          alt: item.alt || undefined,
        });
      }
    }
  }

  // Fall back to the legacy fields only when no media array exists, so a
  // product that has been migrated does not show its old images twice.
  if (out.length === 0 && Array.isArray(source.images)) {
    for (const url of source.images) {
      if (typeof url === "string" && url) out.push({ type: mediaKind(url), url });
    }
  }

  if (typeof source.videoUrl === "string" && source.videoUrl) {
    const already = out.some((m) => m.url === source.videoUrl);
    if (!already) out.push({ type: "video", url: source.videoUrl });
  }

  const images = out.filter((m) => m.type === "image");
  const videos = out.filter((m) => m.type === "video");
  return [...images, ...videos];
}

/** First image in a list — the card thumbnail, OG image and email artwork. */
export function primaryImage(media: MediaItem[]): string {
  return media.find((m) => m.type === "image")?.url ?? media[0]?.url ?? "";
}

/**
 * A poster frame for a video.
 *
 * Cloudinary can render one by swapping the extension to .jpg, which avoids
 * asking the admin to upload a separate still for every clip.
 */
export function videoPoster(item: MediaItem): string | undefined {
  if (item.poster) return item.poster;
  if (item.url.includes(CLOUDINARY_VIDEO_PATH)) {
    return item.url.replace(/\.(mp4|webm|mov|m4v|ogv)(\?.*)?$/i, ".jpg");
  }
  return undefined;
}

/** Cloudinary's resource type segment, needed when requesting a signature. */
export function uploadResourceType(file: { type?: string; name?: string }): "image" | "video" {
  if (file.type?.startsWith("video/")) return "video";
  if (file.name && VIDEO_EXTENSIONS.test(file.name)) return "video";
  return "image";
}
