// Shown while the shop page streams in (Next.js App Router convention file).
export default function ShopLoading() {
  return (
    <main className="mx-auto min-h-[65vh] max-w-6xl px-6 py-10" aria-label="Loading products" aria-live="polite">
      <div className="skeleton-shimmer mb-6 h-8 w-40 rounded" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i}>
            <div className="skeleton-shimmer mb-3 aspect-[4/5] rounded-lg" />
            <div className="skeleton-shimmer mb-2 h-4 w-3/4 rounded" />
            <div className="skeleton-shimmer h-4 w-1/3 rounded" />
          </div>
        ))}
      </div>
    </main>
  );
}
