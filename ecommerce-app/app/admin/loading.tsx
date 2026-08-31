// Admin section loading skeleton.
export default function AdminLoading() {
  return (
    <div className="min-h-[60vh]" aria-label="Loading admin page" aria-live="polite">
      <div className="skeleton-shimmer mb-6 h-8 w-48 rounded" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton-shimmer h-16 rounded" />
        ))}
      </div>
    </div>
  );
}
