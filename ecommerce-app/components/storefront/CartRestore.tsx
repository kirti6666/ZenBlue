"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { useCartStore } from "@/store/useCartStore";

/**
 * Redeems a recovery link and rehydrates the browser cart.
 *
 * The restore REPLACES the cart rather than merging into it. A shopper
 * following a "your cart is waiting" link expects to see that cart, not that
 * cart plus whatever they added since — and merging would silently double
 * quantities on any item present in both.
 */
export function CartRestore() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token");

  const clearCart = useCartStore((s) => s.clearCart);
  const addItem = useCartStore((s) => s.addItem);

  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  const [error, setError] = useState("");
  // React 18 Strict Mode mounts effects twice in development; without this the
  // single-use token would be redeemed and then immediately reported invalid.
  const claimed = useRef(false);

  useEffect(() => {
    if (!token) {
      setState("error");
      setError("This link is missing its token.");
      return;
    }
    if (claimed.current) return;
    claimed.current = true;

    (async () => {
      try {
        const res = await fetch(`/api/cart/restore?token=${encodeURIComponent(token)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "This link is no longer valid");

        try {
          if (json.cartToken) localStorage.setItem("zb-cart-token", json.cartToken);
        } catch {
          /* private mode — the cart still restores, it just will not re-sync */
        }

        clearCart();
        for (const item of json.items ?? []) {
          addItem({
            productId: item.productId,
            title: item.title,
            slug: item.slug,
            price: item.price,
            image: item.image,
            quantity: item.quantity,
            variant: Object.keys(item.variant ?? {}).length ? item.variant : undefined,
            // Re-checked against live stock at checkout; this is only the
            // client-side cap until then.
            maxStock: Math.max(item.quantity, 1),
          });
        }

        setState("done");
        setTimeout(() => router.push("/cart"), 1200);
      } catch (err) {
        setState("error");
        setError(err instanceof Error ? err.message : "This link is no longer valid");
      }
    })();
  }, [token, clearCart, addItem, router]);

  if (state === "loading") {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2 size={22} className="animate-spin text-muted" />
        <p className="text-sm text-muted">Restoring your cart…</p>
      </div>
    );
  }

  if (state === "done") {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-success/10 text-success">
          <Check size={20} />
        </span>
        <p className="text-sm text-heading">Your cart is back. Taking you there now…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-warning/10 text-warning">
        <AlertCircle size={20} />
      </span>
      <p className="text-sm text-heading">{error}</p>
      <p className="text-xs text-muted">
        Recovery links work once and expire — but everything is still in the shop.
      </p>
      <Link
        href="/shop"
        className="mt-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
      >
        Continue shopping
      </Link>
    </div>
  );
}
