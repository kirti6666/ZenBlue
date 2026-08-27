"use client";

import { useEffect, useRef } from "react";
import { useCartStore } from "@/store/useCartStore";

/**
 * Mirrors the browser cart to the server so abandoned-cart recovery has
 * something to work with.
 *
 * The cart itself stays client-side (Zustand + localStorage) — this only
 * snapshots it. A stable per-browser `cartToken` is minted on first use and
 * kept in localStorage, which is what lets the sequence reach GUEST shoppers,
 * not just logged-in ones, as the quotation requires.
 *
 * Syncing is debounced and skipped when the serialized cart has not actually
 * changed, so adjusting a quantity three times sends one request, not three.
 */

const TOKEN_KEY = "zb-cart-token";
const SYNC_DEBOUNCE_MS = 2500;

function getCartToken(): string {
  try {
    let token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      token =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(TOKEN_KEY, token);
    }
    return token;
  } catch {
    // Private mode or blocked storage — recovery simply does not apply.
    return "";
  }
}

export function CartSync() {
  const items = useCartStore((s) => s.items);
  const lastPayload = useRef<string>("");

  useEffect(() => {
    const token = getCartToken();
    if (!token) return;

    const payload = JSON.stringify(
      items.map((i) => ({
        productId: i.productId,
        title: i.title,
        slug: i.slug,
        image: i.image,
        variant: i.variant ?? {},
        quantity: i.quantity,
        price: i.price,
      }))
    );

    // Nothing meaningful changed — don't spend a request on it.
    if (payload === lastPayload.current) return;

    const timer = setTimeout(() => {
      lastPayload.current = payload;
      fetch("/api/abandoned-cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartToken: token, items: JSON.parse(payload) }),
        keepalive: true,
      }).catch(() => {
        // Recovery is best-effort; never surface a sync failure to the shopper.
        lastPayload.current = "";
      });
    }, SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [items]);

  return null;
}
