"use client";

import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { StoreImage } from "./StoreImage";

interface Suggestion {
  _id: string;
  title: string;
  slug: string;
  image: string;
  price: number;
}

/**
 * Header product search with type-ahead.
 *
 * The dropdown is a convenience only — Enter always submits to /shop?search=,
 * so search works identically with the keyboard, with JS still loading, or when
 * the suggestions request fails.
 */
export function SearchBar({ currencySymbol = "₹" }: { currencySymbol?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced so a fast typist fires one request, not one per keystroke.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products/search?q=${encodeURIComponent(term)}&limit=6`, {
          signal: controller.signal,
        });
        const data = await res.json();
        setResults(data.products ?? []);
        setOpen(true);
      } catch {
        /* aborted or offline — the Enter-to-search path still works */
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Close on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = query.trim();
    if (!term) return;
    setOpen(false);
    router.push(`/shop?search=${encodeURIComponent(term)}`);
  }

  return (
    <div ref={boxRef} className="relative w-full">
      <form onSubmit={submit} role="search">
        <label htmlFor="site-search" className="sr-only">
          Search products
        </label>
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          id="site-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          placeholder="Search products…"
          autoComplete="off"
          className="w-full rounded-full border border-line bg-surface py-2 pl-9 pr-9 text-sm text-heading placeholder:text-muted focus:border-primary"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setResults([]);
            }}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-heading"
          >
            <X size={15} />
          </button>
        )}
      </form>

      {open && (results.length > 0 || loading) && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
          {loading && results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">Searching…</p>
          ) : (
            <>
              <ul className="max-h-80 overflow-y-auto">
                {results.map((p) => (
                  <li key={p._id}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        router.push(`/product/${p.slug}`);
                      }}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-alt"
                    >
                      {p.image ? (
                        <StoreImage
                          src={p.image}
                          alt=""
                          width={96}
                          sizes="44px"
                          wrapperClassName="h-11 w-11 shrink-0 rounded-md"
                          className="object-cover"
                        />
                      ) : (
                        <div className="h-11 w-11 rounded-md bg-surface-alt" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-heading">{p.title}</span>
                        <span className="block text-xs text-muted">
                          {currencySymbol}
                          {p.price}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push(`/shop?search=${encodeURIComponent(query.trim())}`);
                }}
                className="block w-full border-t border-line px-4 py-2.5 text-left text-xs font-medium text-link hover:bg-surface-alt"
              >
                See all results for “{query.trim()}”
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
