// Product detail loading skeleton.
export default function ProductLoading() {
  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <div className="grid md:grid-cols-2 gap-10 animate-pulse">
        <div className="aspect-square rounded-lg bg-gray-100" />
        <div className="space-y-4">
          <div className="h-8 w-2/3 bg-gray-100 rounded" />
          <div className="h-6 w-1/4 bg-gray-100 rounded" />
          <div className="h-4 w-full bg-gray-100 rounded" />
          <div className="h-4 w-5/6 bg-gray-100 rounded" />
          <div className="h-11 w-40 bg-gray-100 rounded mt-6" />
        </div>
      </div>
    </main>
  );
}
