"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import { useCurrency } from "@/lib/useCurrency";

export default function CartPage() {
  const [mounted, setMounted] = useState(false);
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const { symbol: currency } = useCurrency();

  useEffect(() => setMounted(true), []);

  if (!mounted) return null; // avoid hydration mismatch with persisted localStorage cart

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-14 text-center sm:px-6 sm:py-16">
        <h1 className="text-2xl font-bold mb-4">Your cart is empty</h1>
        <Link href="/shop" className="text-primary underline">
          Continue shopping
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-5 sm:px-6 sm:py-9">
      <div className="mb-4 flex items-end justify-between border-b border-line pb-3 sm:mb-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted sm:text-xs">Your selection</p>
          <h1 className="font-display text-xl font-semibold text-heading sm:text-2xl">Shopping Bag</h1>
        </div>
        <p className="text-xs text-muted sm:text-sm">
          {items.reduce((sum, item) => sum + item.quantity, 0)} {items.length === 1 ? "item" : "items"}
        </p>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.productId + JSON.stringify(item.variant ?? {})}
            className="grid grid-cols-[84px_minmax(0,1fr)] gap-3 rounded-xl border border-line bg-surface p-3 sm:grid-cols-[104px_minmax(0,1fr)_auto] sm:gap-4 sm:p-4"
          >
            <Link
              href={`/product/${item.slug}`}
              className="block aspect-[4/5] w-[84px] overflow-hidden rounded-lg bg-surface-alt sm:w-[104px]"
              aria-label={`View ${item.title}`}
            >
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center px-2 text-center text-[10px] text-muted">
                  No image
                </span>
              )}
            </Link>

            <div className="flex min-w-0 flex-col text-left">
              <div className="flex items-start justify-between gap-2 sm:block">
                <Link
                  href={`/product/${item.slug}`}
                  className="line-clamp-2 font-display text-sm font-semibold leading-snug text-heading hover:text-link sm:text-base"
                >
                  {item.title}
                </Link>
                <p className="shrink-0 font-sans text-sm font-medium text-heading sm:hidden">
                  {currency}{item.price * item.quantity}
                </p>
              </div>
              {item.variant && Object.keys(item.variant).length > 0 && (
                <p className="mt-1 line-clamp-1 text-[11px] text-muted sm:text-xs">
                  {Object.entries(item.variant)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join("  /  ")}
                </p>
              )}
              <p className="mt-1 font-sans text-xs text-muted">{currency}{item.price} each</p>

              <div className="mt-auto flex items-center justify-between gap-3 pt-3 sm:justify-start">
                <div className="inline-flex h-8 items-center overflow-hidden rounded-full border border-line bg-white">
                  <button
                    onClick={() =>
                      updateQuantity(item.productId, item.quantity - 1, item.variant)
                    }
                    className="flex h-8 w-8 items-center justify-center text-heading transition-colors hover:bg-surface-alt disabled:text-muted"
                    aria-label={`Decrease quantity of ${item.title}`}
                    disabled={item.quantity <= 1}
                  >
                    <Minus size={13} />
                  </button>
                  <span className="min-w-7 text-center font-sans text-xs font-medium text-heading">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() =>
                      updateQuantity(item.productId, item.quantity + 1, item.variant)
                    }
                    className="flex h-8 w-8 items-center justify-center text-heading transition-colors hover:bg-surface-alt disabled:text-muted"
                    disabled={item.quantity >= item.maxStock}
                    aria-label={`Increase quantity of ${item.title}`}
                  >
                    <Plus size={13} />
                  </button>
                </div>
                <button
                  onClick={() => removeItem(item.productId, item.variant)}
                  className="inline-flex items-center gap-1 text-[11px] text-muted transition-colors hover:text-red-600 sm:text-xs"
                  aria-label={`Remove ${item.title} from cart`}
                >
                  <Trash2 size={13} />
                  <span>Remove</span>
                </button>
              </div>
            </div>

            <div className="hidden min-w-20 text-right font-sans text-sm font-medium text-heading sm:block">
              {currency}{item.price * item.quantity}
            </div>
          </div>
        ))}
      </div>

      <section className="mt-4 rounded-xl border border-line bg-surface p-4 sm:ml-auto sm:mt-5 sm:max-w-md sm:p-5">
        <div className="flex items-center justify-between">
          <span className="font-display text-base font-semibold text-heading">Subtotal</span>
          <span className="font-sans text-lg font-semibold text-heading">{currency}{subtotal}</span>
        </div>
        <p className="mt-1 text-left text-[11px] text-muted sm:text-xs">
          Shipping and discounts are calculated at checkout.
        </p>
        <Link
          href="/checkout"
          className="mt-4 block rounded-lg bg-primary py-3 text-center text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Secure Checkout
        </Link>
        <Link
          href="/shop"
          className="mt-3 block text-center text-xs font-medium text-link hover:underline"
        >
          Continue shopping
        </Link>
      </section>
    </main>
  );
}
