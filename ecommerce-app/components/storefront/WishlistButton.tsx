"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { useWishlistStore } from "@/store/useWishlistStore";

interface WishlistButtonProps {
  productId: string;
  /**
   * "overlay" — a floating circular heart, meant to sit on top of a product
   *             card image (position it with a wrapping `relative` container).
   * "inline"  — a bordered button with a label, for the product detail page.
   */
  variant?: "overlay" | "inline";
  className?: string;
}

export function WishlistButton({ productId, variant = "overlay", className = "" }: WishlistButtonProps) {
  const router = useRouter();
  const load = useWishlistStore((s) => s.load);
  const toggle = useWishlistStore((s) => s.toggle);
  // Subscribe to the id set so the heart re-renders when it changes anywhere.
  const active = useWishlistStore((s) => s.ids.has(productId));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    load();
  }, [load]);

  async function onClick(e: React.MouseEvent) {
    // Cards wrap the whole thing in a <Link>; don't navigate when hitting the heart.
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      await toggle(productId);
    } catch {
      // Most likely not logged in — send them to login and back.
      router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
    } finally {
      setBusy(false);
    }
  }

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        aria-pressed={active}
        className={`inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm transition disabled:opacity-50 ${
          active ? "border-red-300 text-red-600 bg-red-50" : "hover:bg-gray-50"
        } ${className}`}
      >
        <Heart size={16} className={active ? "fill-red-500 text-red-500" : ""} />
        {active ? "Saved" : "Save to wishlist"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={active}
      aria-label={active ? "Remove from wishlist" : "Add to wishlist"}
      className={`grid place-items-center h-9 w-9 rounded-full bg-white/90 shadow-sm backdrop-blur transition hover:bg-white disabled:opacity-50 ${className}`}
    >
      <Heart size={18} className={active ? "fill-red-500 text-red-500" : "text-gray-600"} />
    </button>
  );
}
