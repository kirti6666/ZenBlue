"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { useCartStore } from "@/store/useCartStore";

/**
 * Cart icon with a live item count.
 *
 * The count renders as 0 on the server because the cart lives in localStorage;
 * `mounted` gates it so the first client render matches the server HTML and
 * React does not report a hydration mismatch.
 */
export function CartIcon({ className = "" }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const items = useCartStore((s) => s.items);
  useEffect(() => setMounted(true), []);

  const count = mounted ? items.reduce((sum, i) => sum + i.quantity, 0) : 0;

  return (
    <Link
      href="/cart"
      aria-label={count > 0 ? `Cart, ${count} items` : "Cart"}
      className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full text-heading transition-colors hover:bg-surface-alt hover:text-link ${className}`}
    >
      <ShoppingBag size={19} strokeWidth={1.6} />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
