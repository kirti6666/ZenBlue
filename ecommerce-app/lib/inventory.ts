import { connectDB } from "@/lib/db";
import { Product, StockLog, BackInStockRequest } from "@/models";
import { notify } from "@/lib/notifications/dispatch";
import { absoluteUrl } from "@/lib/seo";

/**
 * Inventory service — the single place stock is allowed to change.
 *
 * Every mutation goes through `adjustStock`, which:
 *   - applies the delta to either the flat `stock` or the matching entry in
 *     `variantCombinations`,
 *   - writes an immutable StockLog row (the "stock adjustment log"), and
 *   - fires back-in-stock notifications when a line crosses zero upward.
 *
 * Callers never write `product.stock` directly. That rule is what makes the
 * ledger trustworthy: if the number is wrong, the movement that made it wrong
 * is always on record.
 */

/** Canonical string form of a variant selection: "Colour:Navy / Size:M". */
export function variantKey(variant: Record<string, string> | Map<string, string> | undefined): string {
  if (!variant) return "";
  const obj = variant instanceof Map ? Object.fromEntries(variant) : variant;
  return Object.keys(obj)
    .sort() // sorted so the same selection always produces the same key
    .map((k) => `${k}:${obj[k]}`)
    .join(" / ");
}

/** Human-friendly rendering of a variant, e.g. "Navy · M". */
export function variantLabel(variant: Record<string, string> | Map<string, string> | undefined): string {
  if (!variant) return "";
  const obj = variant instanceof Map ? Object.fromEntries(variant) : variant;
  return Object.values(obj).join(" · ");
}

function combinationMatches(combo: any, key: string): boolean {
  const raw = combo?.combination;
  const obj = raw instanceof Map ? Object.fromEntries(raw) : (raw ?? {});
  return variantKey(obj as Record<string, string>) === key;
}

export interface AdjustStockInput {
  productId: string;
  /** "" for a simple product with no variants. */
  variantKey?: string;
  /** Signed: negative consumes stock, positive returns it. */
  delta: number;
  reason:
    | "manual_adjustment"
    | "order_placed"
    | "order_cancelled"
    | "return_restock"
    | "return_written_off"
    | "exchange_reserved"
    | "csv_import"
    | "erp_sync"
    | "initial_stock";
  note?: string;
  orderId?: string;
  returnRequestId?: string;
  performedBy?: string;
  /** Skip the back-in-stock sweep (e.g. during a bulk import). */
  suppressNotifications?: boolean;
}

export interface AdjustStockResult {
  ok: boolean;
  error?: string;
  resultingStock?: number;
  crossedIntoStock?: boolean;
}

export async function adjustStock(input: AdjustStockInput): Promise<AdjustStockResult> {
  await connectDB();

  const product = await Product.findById(input.productId);
  if (!product) return { ok: false, error: "Product not found" };

  const key = input.variantKey ?? "";
  const hasVariants = Array.isArray(product.variantCombinations) && product.variantCombinations.length > 0;

  let before: number;
  let after: number;
  let sku = product.sku ?? "";

  if (hasVariants && key) {
    const combo = product.variantCombinations.find((c: any) => combinationMatches(c, key));
    if (!combo) return { ok: false, error: `Variant "${key}" not found on this product` };
    before = combo.stock ?? 0;
    after = before + input.delta;
    if (after < 0) return { ok: false, error: `Insufficient stock for ${key}: have ${before}` };
    combo.stock = after;
    sku = combo.sku || sku;
  } else {
    before = product.stock ?? 0;
    after = before + input.delta;
    if (after < 0) return { ok: false, error: `Insufficient stock: have ${before}` };
    product.stock = after;
  }

  await product.save();

  await StockLog.create({
    product: product._id,
    variantKey: key,
    sku,
    delta: input.delta,
    resultingStock: after,
    reason: input.reason,
    note: input.note ?? "",
    order: input.orderId,
    returnRequest: input.returnRequestId,
    performedBy: input.performedBy,
  });

  // Zero → positive is the only transition that should wake the waiting list.
  const crossedIntoStock = before <= 0 && after > 0;
  if (crossedIntoStock && !input.suppressNotifications) {
    await notifyBackInStock(product._id.toString(), key, product.title, product.slug);
  }

  return { ok: true, resultingStock: after, crossedIntoStock };
}

/** Emails/messages everyone waiting on this exact variant, then marks them notified. */
async function notifyBackInStock(productId: string, key: string, title: string, slug: string) {
  try {
    const waiting = await BackInStockRequest.find({
      product: productId,
      variantKey: key,
      status: "waiting",
    }).limit(500);

    for (const req of waiting) {
      await notify({
        event: "back_in_stock",
        recipient: {
          email: req.email || undefined,
          phone: req.phone || undefined,
          userId: req.user?.toString(),
        },
        context: {
          customerName: "there",
          orderNumber: title,
          orderUrl: absoluteUrl(`/product/${slug}`),
          total: 0,
        },
      });
      req.status = "notified";
      req.notifiedAt = new Date();
      await req.save();
    }
  } catch (err) {
    console.error("[inventory] back-in-stock notification failed:", err);
  }
}

/** Total sellable units for a product across all variants. */
export function totalStock(product: any): number {
  if (Array.isArray(product?.variantCombinations) && product.variantCombinations.length > 0) {
    return product.variantCombinations.reduce((sum: number, c: any) => sum + (c.stock ?? 0), 0);
  }
  return product?.stock ?? 0;
}

/** Stock for one specific selection, used by the PDP and the cart guard. */
export function stockForVariant(product: any, key: string): number {
  if (Array.isArray(product?.variantCombinations) && product.variantCombinations.length > 0) {
    const combo = product.variantCombinations.find((c: any) => combinationMatches(c, key));
    return combo?.stock ?? 0;
  }
  return product?.stock ?? 0;
}

/**
 * Every variant at or below its product's low-stock threshold.
 * Powers the dashboard alert and the inventory screen's default filter.
 */
export async function getLowStockLines(limit = 100) {
  await connectDB();
  const products = await Product.find({ isActive: true })
    .select("title slug sku stock lowStockThreshold variantCombinations images")
    .lean();

  const lines: {
    productId: string;
    title: string;
    slug: string;
    variantKey: string;
    sku: string;
    stock: number;
    threshold: number;
    image: string;
  }[] = [];

  for (const p of products as any[]) {
    const threshold = p.lowStockThreshold ?? 5;
    const image = p.images?.[0] ?? "";
    if (p.variantCombinations?.length) {
      for (const combo of p.variantCombinations) {
        const stock = combo.stock ?? 0;
        if (stock <= threshold) {
          lines.push({
            productId: String(p._id),
            title: p.title,
            slug: p.slug,
            variantKey: variantKey(combo.combination),
            sku: combo.sku || p.sku || "",
            stock,
            threshold,
            image,
          });
        }
      }
    } else if ((p.stock ?? 0) <= threshold) {
      lines.push({
        productId: String(p._id),
        title: p.title,
        slug: p.slug,
        variantKey: "",
        sku: p.sku || "",
        stock: p.stock ?? 0,
        threshold,
        image,
      });
    }
  }

  return lines.sort((a, b) => a.stock - b.stock).slice(0, limit);
}
