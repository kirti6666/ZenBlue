/**
 * Shared admin page furniture — title, description, actions slot, and the
 * primitives (cards, tables, empty states, stat tiles) every admin screen
 * reuses. Centralising these is what keeps fifteen admin pages looking like one
 * product rather than fifteen.
 */
export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-heading">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-line bg-surface ${padded ? "p-5" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "success" | "warning" | "error";
}) {
  const toneClass = {
    default: "text-heading",
    success: "text-success",
    warning: "text-warning",
    error: "text-error",
  }[tone];

  return (
    <Card>
      <p className="eyebrow">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold ${toneClass}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

/** Table wrapper that scrolls horizontally instead of breaking the layout. */
export function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full min-w-[640px] text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={`border-b border-line px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className = "",
  title,
}: {
  children?: React.ReactNode;
  className?: string;
  /** Native tooltip — useful on truncated cells that hide their full value. */
  title?: string;
}) {
  return (
    <td title={title} className={`border-b border-line px-4 py-3 text-heading ${className}`}>
      {children}
    </td>
  );
}

export function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface p-12 text-center">
      <p className="text-sm text-muted">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Small coloured pill used for statuses across the admin. */
export function Pill({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "success" | "warning" | "error" | "info";
}) {
  const toneClass = {
    default: "bg-surface-alt text-muted",
    info: "bg-surface-alt text-heading",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    error: "bg-error/10 text-error",
  }[tone];

  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium ${toneClass}`}>
      {children}
    </span>
  );
}
