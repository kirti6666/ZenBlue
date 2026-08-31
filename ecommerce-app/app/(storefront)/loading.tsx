/**
 * Immediate navigation feedback. Next prefetches this lightweight boundary for
 * dynamic storefront routes, so taps respond at once while server data arrives.
 */
export default function StorefrontLoading() {
  return (
    <main className="mx-auto min-h-[65vh] w-full max-w-page px-4 py-5 sm:px-6 sm:py-8" aria-label="Loading page" aria-live="polite">
      <div className="skeleton-shimmer h-7 w-40 rounded" />
      <div className="skeleton-shimmer mt-3 h-3 w-64 max-w-full rounded" />
      <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index}>
            <div className="skeleton-shimmer aspect-[4/5] rounded-lg" />
            <div className="skeleton-shimmer mt-3 h-4 w-4/5 rounded" />
            <div className="skeleton-shimmer mt-2 h-3 w-2/5 rounded" />
          </div>
        ))}
      </div>
    </main>
  );
}
