"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

interface Suggestion {
  _id: string;
  title: string;
  slug: string;
  image: string;
  price: number;
}

/**
 * Search as an ICON that opens a full-width panel, rather than a bar occupying
 * the header.
 *
 * That is what keeps the three-column header balanced: the centre column is
 * reserved for the logo, so search cannot take horizontal space beside it. The
 * panel is a real modal — Escape closes it, focus moves into the field on open
 * and returns to the trigger on close, and the page behind it stops scrolling.
 */
export function SearchOverlay({ currencySymbol = "₹" }: { currencySymbol?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointerDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointerDown);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  // Return focus to the icon when the panel closes, so keyboard users are not
  // dropped back at the top of the document.
  useEffect(() => {
    if (!open) triggerRef.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Debounced, so a fast typist fires one request rather than one per keystroke.
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
      } catch {
        /* aborted or offline — Enter still submits to /shop */
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = query.trim();
    if (!term) return;
    setOpen(false);
    router.push(`/shop?search=${encodeURIComponent(term)}`);
  }

  function go(slug: string) {
    setOpen(false);
    router.push(`/product/${slug}`);
  }

  return (
    <div ref={wrapRef} className="contents sm:relative sm:block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        aria-expanded={open}
        className={`${open ? "hidden sm:flex" : "flex"} h-10 w-10 items-center justify-center rounded-full border-0 text-heading outline-none transition-colors hover:bg-surface-alt hover:text-link focus:outline-none focus:ring-0`}
      >
        <Search size={19} strokeWidth={1.6} />
      </button>

      {open && (
        <div
          className="absolute left-3 right-14 top-1/2 z-[80] -translate-y-1/2 sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 sm:translate-y-0"
          role="dialog"
          aria-label="Search products"
        >
              <form
                onSubmit={submit}
                role="search"
                className="flex items-center gap-2 rounded-xl border border-line bg-background px-3 py-1 shadow-sm transition-shadow focus-within:border-primary focus-within:shadow-md sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-2"
              >
                <Search size={18} className="shrink-0 text-muted" />
                <label htmlFor="site-search" className="sr-only">
                  Search products
                </label>
                <input
                  ref={inputRef}
                  id="site-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search products"
                  autoComplete="off"
                  className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-sm text-heading placeholder:text-muted focus:outline-none sm:py-1"
                />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close search"
                  className="shrink-0 p-1 text-muted hover:text-heading"
                >
                  <X size={18} />
                </button>
              </form>

              {query.trim().length >= 2 && (
                <div className="absolute left-0 right-0 top-full mt-2 max-h-[min(60vh,26rem)] overflow-y-auto rounded-xl border border-line bg-background p-2 shadow-[0_18px_45px_rgba(15,23,42,0.16)] sm:rounded-2xl sm:p-3">
                  {loading && results.length === 0 ? (
                    <p className="py-4 text-sm text-muted">Searching…</p>
                  ) : results.length === 0 ? (
                    <p className="py-4 text-sm text-muted">
                      Nothing matches “{query.trim()}”.
                    </p>
                  ) : (
                    <>
                      <ul className="grid gap-1.5">
                        {results.map((p) => (
                          <li key={p._id}>
                            <button
                              type="button"
                              onClick={() => go(p.slug)}
                              className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-surface-alt"
                            >
                              {p.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={p.image}
                                  alt=""
                                  loading="lazy"
                                  className="h-12 w-12 rounded object-cover"
                                />
                              ) : (
                                <span className="h-12 w-12 rounded bg-surface-alt" />
                              )}
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm text-heading">
                                  {p.title}
                                </span>
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
                        onClick={submit as unknown as () => void}
                        className="mt-3 text-sm text-link underline underline-offset-4"
                      >
                        See all results →
                      </button>
                    </>
                  )}
                </div>
              )}
        </div>
      )}
    </div>
  );
}
