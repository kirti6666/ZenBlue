import { connectDB } from "@/lib/db";
import { Order, ReturnRequest } from "@/models";
import { financialYearOf } from "@/lib/invoice/settings";
import type { SiteSettingsData } from "@/lib/site-settings";
import { RETURN_WINDOW_DAYS } from "@/lib/return-policy";

/**
 * Return / exchange domain rules.
 *
 * All eligibility and state-transition logic lives here rather than in the
 * route handlers, so the customer API, the admin API and the account UI can
 * never disagree about whether a return is allowed.
 */

/**
 * The permitted next states from each status. Anything not listed is rejected
 * by `canTransition`, which is what stops a rejected return from later being
 * refunded, or a request being approved twice by two staff members.
 */
export const RETURN_TRANSITIONS: Record<string, string[]> = {
  requested: ["approved", "rejected", "cancelled"],
  approved: ["pickup_scheduled", "received", "cancelled"],
  pickup_scheduled: ["picked_up", "cancelled"],
  picked_up: ["received"],
  received: ["qc_passed", "qc_failed"],
  qc_passed: ["refund_initiated", "completed"],
  qc_failed: ["refund_initiated", "completed", "rejected"],
  refund_initiated: ["refund_processed"],
  refund_processed: ["completed"],
  completed: [],
  rejected: [],
  cancelled: [],
};

export function canTransition(from: string, to: string): boolean {
  return (RETURN_TRANSITIONS[from] ?? []).includes(to);
}

/** Statuses after which the customer can no longer cancel their own request. */
const CUSTOMER_CANCELLABLE = new Set(["requested", "approved"]);

export function customerCanCancel(status: string): boolean {
  return CUSTOMER_CANCELLABLE.has(status);
}

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
  /** Per line, how many units can still be returned. */
  returnableItems: {
    index: number;
    product: string;
    title: string;
    image: string;
    variant: Record<string, string>;
    variantKey: string;
    unitPrice: number;
    orderedQuantity: number;
    returnedQuantity: number;
    returnableQuantity: number;
  }[];
  /** Last day a request can be raised, for display. */
  windowClosesAt?: Date;
}

/**
 * Decides whether an order can be returned, and how much of each line is still
 * returnable.
 *
 * The window runs from DELIVERY, not from the order date — a parcel that took
 * ten days to arrive must not eat the customer's seven-day window. Orders with
 * no recorded delivery date fall back to the order date only once they are
 * marked delivered, so an in-transit order is never "expired".
 */
export function checkReturnEligibility(
  order: any,
  settings: SiteSettingsData,
  existingReturns: any[] = []
): EligibilityResult {
  const empty: EligibilityResult["returnableItems"] = [];

  if (!settings.returns.enabled) {
    return { eligible: false, reason: "Returns are currently disabled", returnableItems: empty };
  }
  if (order.orderStatus !== "delivered") {
    return {
      eligible: false,
      reason: "You can raise a return once the order has been delivered",
      returnableItems: empty,
    };
  }
  if (order.paymentStatus === "refunded") {
    return { eligible: false, reason: "This order has already been refunded", returnableItems: empty };
  }

  const deliveredAt = order.deliveredAt ? new Date(order.deliveredAt) : new Date(order.updatedAt);
  const windowClosesAt = new Date(deliveredAt.getTime() + RETURN_WINDOW_DAYS * 864e5);
  if (Date.now() > windowClosesAt.getTime()) {
    return {
      eligible: false,
      reason: `The 7-day return and exchange window ended on ${windowClosesAt.toLocaleDateString(
        "en-IN"
      )}. Return and exchange options are no longer available for this order.`,
      returnableItems: empty,
      windowClosesAt,
    };
  }

  // Units already tied up in an open or completed request are not returnable
  // again. Rejected and cancelled requests release their units back.
  const consumed = new Map<string, number>();
  for (const req of existingReturns) {
    if (req.status === "rejected" || req.status === "cancelled") continue;
    for (const item of req.items ?? []) {
      const key = `${String(item.product)}::${item.variantKey ?? ""}`;
      consumed.set(key, (consumed.get(key) ?? 0) + item.quantity);
    }
  }

  const returnableItems = (order.items ?? []).map((item: any, index: number) => {
    const variant =
      item.variant instanceof Map ? Object.fromEntries(item.variant) : (item.variant ?? {});
    const variantKey = Object.keys(variant)
      .sort()
      .map((k) => `${k}:${variant[k]}`)
      .join(" / ");
    const key = `${String(item.product)}::${variantKey}`;
    const returned = Math.max(item.returnedQuantity ?? 0, consumed.get(key) ?? 0);

    return {
      index,
      product: String(item.product),
      title: item.title,
      image: item.image ?? "",
      variant,
      variantKey,
      unitPrice: item.price,
      orderedQuantity: item.quantity,
      returnedQuantity: returned,
      returnableQuantity: Math.max(0, item.quantity - returned),
    };
  });

  const anyReturnable = returnableItems.some((i: any) => i.returnableQuantity > 0);
  if (!anyReturnable) {
    return {
      eligible: false,
      reason: "Every item on this order already has a return request",
      returnableItems,
      windowClosesAt,
    };
  }

  return { eligible: true, returnableItems, windowClosesAt };
}

/**
 * Refund value for a set of returned lines.
 *
 * Two rules matter here and both favour correctness over simplicity:
 *   - Any order-level coupon discount is apportioned across the returned lines
 *     in proportion to their value, so returning one item out of three cannot
 *     refund the full pre-discount price and hand back more than was paid.
 *   - Shipping is refunded only on a full return caused by our error; the
 *     caller decides that and passes `includeShipping`.
 */
export function computeRefundAmount(
  order: any,
  lines: { unitPrice: number; quantity: number }[],
  opts: { includeShipping?: boolean } = {}
): number {
  const lineValue = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const orderSubtotal = order.subtotal || 0;

  const discountShare =
    orderSubtotal > 0 && order.discount > 0
      ? (lineValue / orderSubtotal) * order.discount
      : 0;

  let refund = lineValue - discountShare;
  if (opts.includeShipping) refund += order.shippingFee ?? 0;

  return Math.max(0, Math.round((refund + Number.EPSILON) * 100) / 100);
}

/**
 * Generates the next RMA number: RET/<FY>/<zero-padded sequence>.
 *
 * The sequence is derived from a count within the financial year rather than a
 * shared counter document. RMA numbers are a customer-facing reference, not a
 * statutory series — unlike invoice numbers they carry no legal no-gaps
 * requirement, so this avoids a second contended counter on the hot path.
 */
export async function generateRmaNumber(): Promise<string> {
  await connectDB();
  const now = new Date();
  const fy = financialYearOf(now);
  const fyStart = new Date(now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1, 3, 1);

  const count = await ReturnRequest.countDocuments({ createdAt: { $gte: fyStart } });
  return `RET/${fy}/${String(count + 1).padStart(5, "0")}`;
}

/** Appends a timeline entry — the customer-visible history of the request. */
export function pushTimeline(doc: any, status: string, note = "", by?: string) {
  doc.timeline = doc.timeline ?? [];
  doc.timeline.push({ status, note, at: new Date(), by });
}

/**
 * Keeps `returnedQuantity` on the order's lines in step with an approved
 * request, so eligibility for any FUTURE request is computed from the order
 * itself and does not require replaying every past return.
 */
export async function syncOrderReturnedQuantities(orderId: string) {
  await connectDB();
  const [order, requests] = await Promise.all([
    Order.findById(orderId),
    ReturnRequest.find({ order: orderId, status: { $nin: ["rejected", "cancelled"] } }).lean(),
  ]);
  if (!order) return;

  const consumed = new Map<string, number>();
  for (const req of requests as any[]) {
    for (const item of req.items ?? []) {
      const key = `${String(item.product)}::${item.variantKey ?? ""}`;
      consumed.set(key, (consumed.get(key) ?? 0) + item.quantity);
    }
  }

  for (const item of order.items) {
    const variant =
      item.variant instanceof Map ? Object.fromEntries(item.variant) : ((item.variant as any) ?? {});
    const variantKey = Object.keys(variant)
      .sort()
      .map((k) => `${k}:${variant[k]}`)
      .join(" / ");
    item.returnedQuantity = consumed.get(`${String(item.product)}::${variantKey}`) ?? 0;
  }

  await order.save();
}

export const RETURN_REASON_LABELS: Record<string, string> = {
  size_fit_issue: "Size or fit issue",
  damaged_or_defective: "Arrived damaged or defective",
  wrong_item_received: "Wrong item received",
  not_as_described: "Not as described on the site",
  quality_not_expected: "Quality not as expected",
  changed_mind: "Changed my mind",
  other: "Something else",
};

export const RETURN_STATUS_LABELS: Record<string, string> = {
  requested: "Requested",
  approved: "Approved",
  rejected: "Rejected",
  pickup_scheduled: "Pickup scheduled",
  picked_up: "Picked up",
  received: "Received at warehouse",
  qc_passed: "Quality check passed",
  qc_failed: "Quality check failed",
  refund_initiated: "Refund initiated",
  refund_processed: "Refund processed",
  completed: "Completed",
  cancelled: "Cancelled",
};
