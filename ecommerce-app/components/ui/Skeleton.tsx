// Reusable skeleton loaders. Pure presentational markup (no hooks / no "use client"),
// so these can be used BOTH inside server `loading.tsx` files AND inside client
// pages' own loading state. The shared shimmer prevents inconsistent loaders.

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded ${className}`} />;
}

/** A single product card placeholder (image + two text lines). */
export function ProductCardSkeleton() {
  return (
    <div>
      <div className="skeleton-shimmer mb-3 aspect-[4/5] rounded-lg" />
      <div className="skeleton-shimmer mb-2 h-4 w-3/4 rounded" />
      <div className="skeleton-shimmer h-4 w-1/3 rounded" />
    </div>
  );
}

/** A responsive grid of product card placeholders. */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Admin table placeholder (header row + N body rows). */
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full border rounded-md overflow-hidden">
      <div className="flex bg-gray-50 border-b">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="flex-1 p-3">
            <div className="skeleton-shimmer h-3 w-2/3 rounded" />
          </div>
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex border-b last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="flex-1 p-3">
              <div className="skeleton-shimmer h-4 w-3/4 rounded" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Stacked "card" placeholders — for admin order/review lists. */
export function CardListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border rounded-md p-4">
          <div className="flex justify-between gap-3">
            <div className="flex-1 space-y-2">
              <div className="skeleton-shimmer h-3 w-24 rounded" />
              <div className="skeleton-shimmer h-4 w-40 rounded" />
              <div className="skeleton-shimmer h-3 w-32 rounded" />
            </div>
            <div className="skeleton-shimmer h-6 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Product detail placeholder (gallery + info column). */
export function ProductDetailSkeleton() {
  return (
    <div className="grid md:grid-cols-2 gap-10">
      <div className="skeleton-shimmer aspect-[4/5] rounded-lg" />
      <div className="space-y-4">
        <div className="skeleton-shimmer h-8 w-2/3 rounded" />
        <div className="skeleton-shimmer h-6 w-1/4 rounded" />
        <div className="skeleton-shimmer h-4 w-full rounded" />
        <div className="skeleton-shimmer h-4 w-5/6 rounded" />
        <div className="skeleton-shimmer h-4 w-4/6 rounded" />
        <div className="skeleton-shimmer mt-6 h-11 w-44 rounded" />
      </div>
    </div>
  );
}

/** Order summary placeholder (order-success / order detail pages). */
export function OrderSummarySkeleton() {
  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="skeleton-shimmer h-7 w-48 rounded" />
      <div className="border rounded-md p-4 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex justify-between">
            <div className="skeleton-shimmer h-4 w-40 rounded" />
            <div className="skeleton-shimmer h-4 w-16 rounded" />
          </div>
        ))}
        <div className="border-t pt-3 flex justify-between">
          <div className="skeleton-shimmer h-5 w-20 rounded" />
          <div className="skeleton-shimmer h-5 w-24 rounded" />
        </div>
      </div>
    </div>
  );
}

/** Generic vertical list of text-line placeholders. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-shimmer h-16 rounded" />
      ))}
    </div>
  );
}

/** Analytics dashboard placeholder (KPI cards + chart blocks). */
export function AnalyticsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4">
            <div className="skeleton-shimmer mb-3 h-3 w-20 rounded" />
            <div className="skeleton-shimmer h-7 w-16 rounded" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border p-5">
        <div className="skeleton-shimmer h-40 rounded" />
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="skeleton-shimmer h-48 rounded-lg border" />
        <div className="skeleton-shimmer h-48 rounded-lg border" />
      </div>
    </div>
  );
}
