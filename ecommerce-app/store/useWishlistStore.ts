"use client";

import { create } from "zustand";

/**
 * Client-side mirror of the server-backed wishlist (User.wishlist). The source
 * of truth is the database; this store just caches the set of saved product ids
 * so every <WishlistButton> on a page shares one state and we only fetch the
 * list once. Toggling optimistically updates the set, then persists to the API
 * (rolling back on failure).
 *
 * Not persisted to localStorage on purpose — it's per-account data that must
 * come from the server, and a stale local copy across accounts would be wrong.
 */
interface WishlistState {
  ids: Set<string>;
  loaded: boolean;
  loading: boolean;
  /** Fetch the id set once (no-op if already loaded/loading). */
  load: () => Promise<void>;
  has: (productId: string) => boolean;
  /** Optimistically add/remove and sync to the server. Returns the new state. */
  toggle: (productId: string) => Promise<boolean>;
}

export const useWishlistStore = create<WishlistState>((set, get) => ({
  ids: new Set(),
  loaded: false,
  loading: false,

  load: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    try {
      const res = await fetch("/api/wishlist?ids=true");
      if (res.ok) {
        const data = await res.json();
        set({ ids: new Set<string>(data.ids ?? []), loaded: true });
      } else {
        // 401 (logged out) etc. — treat as an empty, "loaded" wishlist so the
        // buttons still render; toggling will prompt login.
        set({ loaded: true });
      }
    } catch {
      set({ loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  has: (productId) => get().ids.has(productId),

  toggle: async (productId) => {
    const currentlyIn = get().ids.has(productId);
    const next = new Set(get().ids);
    if (currentlyIn) next.delete(productId);
    else next.add(productId);
    set({ ids: next });

    try {
      const res = currentlyIn
        ? await fetch(`/api/wishlist?product=${productId}`, { method: "DELETE" })
        : await fetch("/api/wishlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId }),
          });
      if (!res.ok) throw new Error("request failed");
      return !currentlyIn;
    } catch {
      // Roll back the optimistic change on failure.
      const rolledBack = new Set(get().ids);
      if (currentlyIn) rolledBack.add(productId);
      else rolledBack.delete(productId);
      set({ ids: rolledBack });
      throw new Error("Failed to update wishlist");
    }
  },
}));
