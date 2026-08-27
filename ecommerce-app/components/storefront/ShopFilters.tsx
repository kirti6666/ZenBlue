"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search } from "lucide-react";

interface Category {
  _id: string;
  name: string;
  slug: string;
}

interface ShopFiltersProps {
  categories: Category[];
  currentCategory?: string;
  currentSearch?: string;
  currentSort?: string;
}

export function ShopFilters({
  categories,
  currentCategory,
  currentSearch,
  currentSort,
}: ShopFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(currentSearch ?? "");

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page"); // reset pagination whenever a filter changes
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateParam("search", search);
  }

  return (
    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-3">
      <form onSubmit={handleSearchSubmit} className="col-span-2 flex w-full gap-2 sm:w-auto">
        <input
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-primary sm:w-64"
        />
        <button
          type="submit"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-heading transition-colors hover:border-primary sm:w-auto sm:px-4"
          aria-label="Search products"
        >
          <Search size={17} />
          <span className="sr-only sm:not-sr-only sm:ml-2 sm:text-xs sm:font-medium">Search</span>
        </button>
      </form>

      <select
        value={currentCategory ?? ""}
        onChange={(e) => updateParam("category", e.target.value)}
        aria-label="Filter by category"
        className="h-10 min-w-0 w-full rounded-lg border border-line bg-white px-2.5 text-xs text-heading outline-none focus:border-primary sm:w-auto sm:px-3 sm:text-sm"
      >
        <option value="">All Categories</option>
        {categories.map((c) => (
          <option key={c._id} value={c.slug}>
            {c.name}
          </option>
        ))}
      </select>

      <select
        value={currentSort ?? "newest"}
        onChange={(e) => updateParam("sort", e.target.value)}
        aria-label="Sort products"
        className="h-10 min-w-0 w-full rounded-lg border border-line bg-white px-2.5 text-xs text-heading outline-none focus:border-primary sm:w-auto sm:px-3 sm:text-sm"
      >
        <option value="newest">Newest</option>
        <option value="price_asc">Price: Low to High</option>
        <option value="price_desc">Price: High to Low</option>
      </select>
    </div>
  );
}
