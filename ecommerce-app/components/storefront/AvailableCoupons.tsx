"use client";

import { useEffect, useState } from "react";
import { Tag } from "lucide-react";
import { useCurrency } from "@/lib/useCurrency";

interface AvailableCoupon {
  _id: string;
  code: string;
  discountType: "percent" | "flat";
  value: number;
  minOrderValue: number;
  expiresAt: string;
}

interface AvailableCouponsProps {
  /** Current cart subtotal — used to flag coupons that need a higher order value. */
  subtotal?: number;
  /** The code currently applied at checkout (to show an "Applied" state). */
  appliedCode?: string | null;
  /** Called when the shopper taps a coupon. Wire this to your apply handler. */
  onApply?: (code: string) => void;
}

/**
 * Shows the store's currently-usable coupons (from /api/coupons/available) so
 * shoppers can discover and one-tap apply them. Renders nothing when there are
 * no available coupons, so it's safe to drop into cart or checkout unconditionally.
 */
export function AvailableCoupons({ subtotal, appliedCode, onApply }: AvailableCouponsProps) {
  const { symbol: currency } = useCurrency();
  const [coupons, setCoupons] = useState<AvailableCoupon[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/coupons/available")
      .then((r) => r.json())
      .then((d) => {
        if (active) setCoupons(d.coupons ?? []);
      })
      .catch(() => {})
      .finally(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, []);

  if (!loaded || coupons.length === 0) return null;

  const describe = (c: AvailableCoupon) =>
    c.discountType === "percent" ? `${c.value}% off` : `${currency}${c.value} off`;

  return (
    <div className="mt-3">
      <p className="mb-1.5 flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
        <Tag size={13} /> Available offers
      </p>
      <div className="space-y-1.5">
        {coupons.map((c) => {
          const eligible = subtotal === undefined || subtotal >= c.minOrderValue;
          const applied = appliedCode === c.code;
          const shortfall = c.minOrderValue - (subtotal ?? 0);

          return (
            <div
              key={c._id}
              className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-line bg-surface px-2.5 py-2 text-xs"
            >
              <div className="min-w-0">
                <span className="font-sans font-semibold text-heading">{c.code}</span>
                <span className="text-muted"> · {describe(c)}</span>
                {c.minOrderValue > 0 && (
                  <p className="mt-0.5 text-[10px] text-muted">
                    {eligible
                      ? `On orders over ${currency}${c.minOrderValue}`
                      : `Add ${currency}${shortfall} more to use`}
                  </p>
                )}
              </div>

              {applied ? (
                <span className="shrink-0 text-[11px] font-medium text-green-600">Applied</span>
              ) : (
                <button
                  type="button"
                  disabled={!eligible}
                  onClick={() => onApply?.(c.code)}
                  className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-[11px] font-medium text-heading hover:border-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Apply
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
