"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";

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
  currentFabric?: string;
  currentColour?: string;
  currentSize?: string;
  inStock?: boolean;
  fabrics?: string[];
  colours?: string[];
  sizes?: string[];
  showCategory?: boolean;
}

export function ShopFilters({
  categories,
  currentCategory,
  currentSearch,
  currentSort,
  currentFabric,
  currentColour,
  currentSize,
  inStock = false,
  fabrics = [],
  colours = [],
  sizes = [],
  showCategory = true,
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

  const hasFilters = Boolean(
    currentCategory || currentSearch || currentFabric || currentColour || currentSize || inStock
  );

  function clearFilters() {
    const params = new URLSearchParams();
    if (currentSort && currentSort !== "newest") params.set("sort", currentSort);
    router.push(`${pathname}${params.size ? `?${params}` : ""}`);
    setSearch("");
  }

  return (
    <div className="grid w-full grid-cols-2 gap-1.5 sm:flex sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-2">
      <form onSubmit={handleSearchSubmit} className="col-span-2 flex w-full gap-1.5 sm:w-auto">
        <input
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 min-w-0 flex-1 rounded-md border border-line bg-white px-3 text-xs outline-none focus:border-primary sm:h-10 sm:w-64 sm:rounded-lg sm:text-sm"
        />
        <button
          type="submit"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-heading transition-colors hover:border-primary sm:h-10 sm:w-auto sm:rounded-lg sm:px-4"
          aria-label="Search products"
        >
          <Search size={17} />
          <span className="sr-only sm:not-sr-only sm:ml-2 sm:text-xs sm:font-medium">Search</span>
        </button>
      </form>

      {showCategory && <select
        value={currentCategory ?? ""}
        onChange={(e) => updateParam("category", e.target.value)}
        aria-label="Filter by category"
        className="h-9 min-w-0 w-full rounded-md border border-line bg-white px-2.5 text-[11px] text-heading outline-none focus:border-primary sm:h-10 sm:w-auto sm:rounded-lg sm:px-3 sm:text-sm"
      >
        <option value="">All Categories</option>
        {categories.map((c) => (
          <option key={c._id} value={c.slug}>
            {c.name}
          </option>
        ))}
      </select>}

      <select value={currentFabric ?? ""} onChange={(e) => updateParam("fabric", e.target.value)} aria-label="Filter by fabric" className="h-9 min-w-0 w-full rounded-md border border-line bg-white px-2.5 text-[11px] text-heading outline-none focus:border-primary sm:h-10 sm:w-auto sm:max-w-48 sm:rounded-lg sm:px-3 sm:text-sm">
        <option value="">All fabrics</option>
        {fabrics.map((value) => <option key={value} value={value}>{value}</option>)}
      </select>

      <select value={currentColour ?? ""} onChange={(e) => updateParam("colour", e.target.value)} aria-label="Filter by colour" className="h-9 min-w-0 w-full rounded-md border border-line bg-white px-2.5 text-[11px] text-heading outline-none focus:border-primary sm:h-10 sm:w-auto sm:rounded-lg sm:px-3 sm:text-sm">
        <option value="">All colours</option>
        {colours.map((value) => <option key={value} value={value}>{value}</option>)}
      </select>

      <select value={currentSize ?? ""} onChange={(e) => updateParam("size", e.target.value)} aria-label="Filter by size" className="h-9 min-w-0 w-full rounded-md border border-line bg-white px-2.5 text-[11px] text-heading outline-none focus:border-primary sm:h-10 sm:w-auto sm:rounded-lg sm:px-3 sm:text-sm">
        <option value="">All sizes</option>
        {sizes.map((value) => <option key={value} value={value}>{value}</option>)}
      </select>

      <button type="button" onClick={() => updateParam("inStock", inStock ? "" : "1")} aria-pressed={inStock} className={`h-9 rounded-md border px-2.5 text-[11px] font-medium transition-colors sm:h-10 sm:rounded-lg sm:px-3 sm:text-sm ${inStock ? "border-primary bg-primary text-primary-foreground" : "border-line bg-surface text-heading hover:border-primary"}`}>
        In stock
      </button>

      <select
        value={currentSort ?? "newest"}
        onChange={(e) => updateParam("sort", e.target.value)}
        aria-label="Sort products"
        className="h-9 min-w-0 w-full rounded-md border border-line bg-white px-2.5 text-[11px] text-heading outline-none focus:border-primary sm:h-10 sm:w-auto sm:rounded-lg sm:px-3 sm:text-sm"
      >
        <option value="newest">Newest</option>
        <option value="price_asc">Price: Low to High</option>
        <option value="price_desc">Price: High to Low</option>
      </select>

      {hasFilters && <button type="button" onClick={clearFilters} className="inline-flex h-9 items-center justify-center gap-1 rounded-md px-2 text-[11px] text-muted hover:text-heading sm:h-10 sm:text-xs"><X size={13}/> Clear</button>}
    </div>
  );
}
