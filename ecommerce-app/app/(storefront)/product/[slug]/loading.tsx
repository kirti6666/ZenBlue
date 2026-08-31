// Product detail loading skeleton.
export default function ProductLoading() {
  return (
    <main className="mx-auto min-h-[65vh] max-w-6xl px-6 py-10" aria-label="Loading product" aria-live="polite">
      <div className="grid gap-10 md:grid-cols-2">
        <div className="skeleton-shimmer aspect-[4/5] rounded-lg" />
        <div className="space-y-4">
          <div className="skeleton-shimmer h-8 w-2/3 rounded" />
          <div className="skeleton-shimmer h-6 w-1/4 rounded" />
          <div className="skeleton-shimmer h-4 w-full rounded" />
          <div className="skeleton-shimmer h-4 w-5/6 rounded" />
          <div className="skeleton-shimmer mt-6 h-11 w-40 rounded" />
        </div>
      </div>
    </main>
  );
}
