import { ProductGridSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function CategoryLoading() {
  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <Skeleton className="h-8 w-48 mb-6" />
      <ProductGridSkeleton count={8} />
    </main>
  );
}
