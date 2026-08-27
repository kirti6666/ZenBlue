// Shown while the shop page streams in (Next.js App Router convention file).
export default function ShopLoading() {
  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <div className="h-8 w-40 bg-gray-100 rounded animate-pulse mb-6" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-square rounded-lg bg-gray-100 mb-3" />
            <div className="h-4 w-3/4 bg-gray-100 rounded mb-2" />
            <div className="h-4 w-1/3 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </main>
  );
}
