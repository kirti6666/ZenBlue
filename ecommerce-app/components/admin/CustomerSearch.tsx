"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

/**
 * Customer search box. Submits as a URL change rather than fetching, so the
 * server component re-renders with the filter applied and the result is a
 * shareable, back-button-friendly link.
 */
export function CustomerSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = value.trim();
    router.push(term ? `/admin/customers?search=${encodeURIComponent(term)}` : "/admin/customers");
  }

  return (
    <form onSubmit={submit} role="search" className="relative max-w-sm">
      <label htmlFor="customer-search" className="sr-only">
        Search customers
      </label>
      <Search
        size={15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
      />
      <input
        id="customer-search"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search by name, email or phone…"
        className="w-full rounded-lg border border-line bg-surface py-2.5 pl-9 pr-3 text-sm text-heading placeholder:text-muted focus:border-primary"
      />
    </form>
  );
}
