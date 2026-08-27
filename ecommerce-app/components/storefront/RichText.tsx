/**
 * Minimal Markdown renderer for CMS page bodies.
 *
 * A full Markdown library would be the obvious choice, but page bodies here are
 * authored by the shop owner in an admin textarea and only ever need headings,
 * paragraphs, lists, bold/italic and links. This keeps the client bundle
 * untouched and, more importantly, escapes the input first — so a pasted
 * <script> in a policy page cannot execute.
 */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|\W)\*(?!\s)(.+?)(?<!\s)\*/g, "$1<em>$2</em>")
    // Only http(s) and site-relative links — no javascript: URLs.
    .replace(/\[(.+?)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g, '<a href="$2">$1</a>');
}

export function markdownToHtml(md: string): string {
  const lines = (md ?? "").replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (!line.trim()) {
      closeList();
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1].length + 1; // "#" maps to h2 — h1 is the page title
      out.push(`<h${Math.min(level, 6)}>${inline(heading[2])}</h${Math.min(level, 6)}>`);
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      if (listType !== "ul") {
        closeList();
        out.push("<ul>");
        listType = "ul";
      }
      out.push(`<li>${inline(bullet[1])}</li>`);
      continue;
    }

    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (numbered) {
      if (listType !== "ol") {
        closeList();
        out.push("<ol>");
        listType = "ol";
      }
      out.push(`<li>${inline(numbered[1])}</li>`);
      continue;
    }

    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }

  closeList();
  return out.join("\n");
}

/** Renders a CMS body with the storefront's typographic rhythm. */
export function RichText({
  content,
  className = "",
  compact = false,
}: {
  content: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`space-y-4 text-[15px] leading-relaxed text-body
        [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-heading
        [&_h3]:mt-6 [&_h3]:font-display [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-heading
        [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5
        [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5
        [&_a]:text-link [&_a]:underline [&_a]:underline-offset-4
        [&_strong]:font-semibold [&_strong]:text-heading
        ${
          compact
            ? "!space-y-3 !text-[14px] !leading-6 sm:!text-[15px] sm:!leading-7 [&_h2]:!mt-5 [&_h2]:!text-base sm:[&_h2]:!text-lg [&_h3]:!mt-4 [&_p]:max-w-[72ch] [&_li]:pl-0.5"
            : ""
        } ${className}`}
      dangerouslySetInnerHTML={{ __html: markdownToHtml(content) }}
    />
  );
}
