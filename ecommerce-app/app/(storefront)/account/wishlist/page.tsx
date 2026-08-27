"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Heart, X } from "lucide-react";
import { useWishlistStore } from "@/store/useWishlistStore";

interface WishlistProduct {
  _id: string;
  title: string;
  slug: string;
  price: number;
  discountPrice?: number;
  images: string[];
  category?: { name: string } | null;
}

function WishlistSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 sm:gap-4" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="grid animate-pulse grid-cols-[88px_minmax(0,1fr)_32px] gap-3 rounded-xl border border-line bg-surface p-2.5 sm:grid-cols-[104px_minmax(0,1fr)_32px] sm:p-3"
        >
          <div className="aspect-[4/5] rounded-lg bg-surface-alt" />
          <div className="self-center space-y-2">
            <div className="h-2 w-16 rounded bg-surface-alt" />
            <div className="h-3.5 w-4/5 rounded bg-surface-alt" />
            <div className="h-3 w-20 rounded bg-surface-alt" />
          </div>
          <div className="h-8 w-8 rounded-full bg-surface-alt" />
        </div>
      ))}
    </div>
  );
}

export default function WishlistPage() {
  const [products, setProducts] = useState<WishlistProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/wishlist");
      if (res.status === 401) {
        setUnauthorized(true);
        return;
      }
      const data = await res.json();
      setProducts(data.products ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(productId: string) {
    const removed = products.find((product) => product._id === productId);
    setProducts((prev) => prev.filter((p) => p._id !== productId));
    try {
      const res = await fetch(`/api/wishlist?product=${productId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not remove item");

      // Mirror the successful delete locally without issuing a second request.
      const ids = new Set(useWishlistStore.getState().ids);
      ids.delete(productId);
      useWishlistStore.setState({ ids });
    } catch {
      if (removed) setProducts((prev) => [removed, ...prev]);
    }
  }

  return (
    <section aria-labelledby="wishlist-heading" className="mx-auto w-full min-w-0 max-w-4xl">
      <header className="mb-4 flex items-end justify-between border-b border-line pb-3 sm:mb-5 sm:pb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted">Saved pieces</p>
          <h1 id="wishlist-heading" className="mt-1 font-display text-2xl font-semibold text-heading sm:text-3xl">
            My Wishlist
          </h1>
        </div>
        {!loading && !unauthorized && (
          <span className="rounded-full bg-surface-alt px-2.5 py-1 font-sans text-xs tabular-nums text-body">
            {products.length} {products.length === 1 ? "item" : "items"}
          </span>
        )}
      </header>

      {loading ? (
        <WishlistSkeleton />
      ) : unauthorized ? (
        <div className="rounded-xl border border-line bg-surface p-6 text-center sm:p-8">
          <Heart className="mx-auto text-muted" size={24} strokeWidth={1.5} />
          <p className="mt-3 text-sm text-body">Sign in to view your saved pieces.</p>
          <Link
            href="/login?callbackUrl=/account/wishlist"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Sign in <ArrowRight size={15} />
          </Link>
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface px-5 py-10 text-center sm:py-12">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-surface-alt text-muted">
            <Heart size={20} strokeWidth={1.5} />
          </span>
          <h2 className="mt-3 font-display text-lg font-semibold text-heading">Nothing saved yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Tap the heart on any product to keep it here for later.
          </p>
          <Link
            href="/shop"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Browse products <ArrowRight size={15} />
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          {products.map((p) => {
            const hasDiscount = Boolean(p.discountPrice && p.discountPrice < p.price);
            return (
              <article
                key={p._id}
                className="group relative grid grid-cols-[88px_minmax(0,1fr)_32px] gap-3 rounded-xl border border-line bg-surface p-2.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md sm:grid-cols-[104px_minmax(0,1fr)_32px] sm:p-3"
              >
                <Link
                  href={`/product/${p.slug}`}
                  aria-label={`View ${p.title}`}
                  className="block aspect-[4/5] overflow-hidden rounded-lg bg-surface-alt"
                >
                  {p.images?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.images[0]}
                      alt={p.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <span className="grid h-full w-full place-items-center px-2 text-center text-[10px] text-muted">
                      No image
                    </span>
                  )}
                </Link>

                <div className="min-w-0 self-center py-0.5">
                  {p.category?.name && (
                    <p className="truncate text-[9px] uppercase tracking-[0.16em] text-muted">
                      {p.category.name}
                    </p>
                  )}
                  <Link href={`/product/${p.slug}`}>
                    <h2 className="mt-0.5 line-clamp-2 font-display text-sm font-semibold leading-snug text-heading sm:text-base">
                      {p.title}
                    </h2>
                  </Link>
                  <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-sans tabular-nums">
                    <span className="text-sm font-medium text-heading">
                      ₹{(hasDiscount ? p.discountPrice : p.price)?.toLocaleString("en-IN")}
                    </span>
                    {hasDiscount && (
                      <span className="text-xs text-muted line-through">
                        ₹{p.price.toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/product/${p.slug}`}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-link"
                  >
                    View product <ArrowRight size={12} />
                  </Link>
                </div>

                <button
                  type="button"
                  onClick={() => remove(p._id)}
                  aria-label={`Remove ${p.title} from wishlist`}
                  className="grid h-8 w-8 place-items-center rounded-full border border-line text-muted transition-colors hover:border-primary hover:bg-surface-alt hover:text-heading"
                >
                  <X size={14} strokeWidth={1.7} />
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
