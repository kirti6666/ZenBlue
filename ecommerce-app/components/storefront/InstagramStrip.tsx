import { Instagram } from "lucide-react";
import type { InstagramPost } from "@/lib/site-settings";
import { StoreImage } from "./StoreImage";

/**
 * Instagram feed strip.
 *
 * Posts are managed in Site Settings rather than pulled live from the Graph
 * API. That is a deliberate first-release choice: the Basic Display API needs
 * a token that expires every 60 days and silently empties the section when it
 * lapses. Swapping the data source later touches only the caller.
 */
export function InstagramStrip({
  heading,
  handle,
  posts,
  profileUrl,
}: {
  heading: string;
  handle: string;
  posts: InstagramPost[];
  profileUrl: string;
}) {
  if (!posts || posts.length === 0) return null;

  return (
    <section className="mx-auto max-w-page px-5 py-10 sm:px-6 sm:py-14">
      <div className="mb-5 flex flex-col items-center justify-center gap-3 text-center sm:mb-7 sm:flex-row sm:items-end sm:justify-between sm:text-left">
        <h2 className="font-display text-xl font-semibold text-heading sm:text-2xl md:text-3xl">{heading}</h2>
        {profileUrl && (
          <a
            href={profileUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm text-link hover:underline"
          >
            <Instagram size={15} />
            {handle ? `@${handle}` : "Follow"}
          </a>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3 md:grid-cols-6">
        {posts.slice(0, 6).map((post, i) => (
          <a
            key={i}
            href={post.link || profileUrl || "#"}
            target="_blank"
            rel="noreferrer"
            className="group relative aspect-square overflow-hidden rounded-lg bg-surface-alt"
          >
            {post.image && (
              <StoreImage
                src={post.image}
                alt={post.caption || ""}
                width={480}
                sizes="(max-width: 768px) 33vw, 16vw"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-brand/0 text-white opacity-0 transition-all group-hover:bg-brand/40 group-hover:opacity-100">
              <Instagram size={20} />
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
