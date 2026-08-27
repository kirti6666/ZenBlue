/**
 * Shared page masthead: title and optional standfirst.
 * Using one component keeps every inner page vertically consistent, which is
 * most of what makes a small catalogue feel like a designed site.
 */
export function PageHeader({
  title,
  subtitle,
  align = "left",
  compact = false,
}: {
  title: string;
  subtitle?: string;
  breadcrumbs?: { name: string; path: string }[];
  align?: "left" | "center";
  compact?: boolean;
}) {
  const centered = align === "center";

  return (
    <div
      className={`${compact ? "bg-transparent" : "border-b border-line bg-surface-alt"} text-center ${
        centered ? "" : "sm:text-left"
      }`}
    >
      <div
        className={`mx-auto max-w-page px-4 sm:px-6 ${
          compact ? "py-4 sm:py-6 md:py-7" : "py-8 sm:py-10 md:py-14"
        }`}
      >
        <h1
          className={`font-display font-semibold tracking-tight text-heading ${
            compact ? "text-xl sm:text-2xl md:text-3xl" : "text-2xl sm:text-3xl md:text-4xl"
          }`}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className={`mx-auto max-w-2xl text-body ${
              compact ? "mt-1.5 text-xs leading-relaxed sm:mt-2 sm:text-sm" : "mt-3 text-[15px]"
            } ${centered ? "" : "sm:mx-0"}`}
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
