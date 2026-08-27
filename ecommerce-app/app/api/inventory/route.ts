import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { StockLog } from "@/models";
import { requireAdmin } from "@/lib/middleware/requireAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { logAdminAction, getClientIp } from "@/lib/middleware/logAdminAction";
import { adjustStock, getLowStockLines } from "@/lib/inventory";

export const dynamic = "force-dynamic";

/** Low-stock lines and the recent movement ledger. */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, PERMISSIONS.INVENTORY);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");

    const [lowStock, logs] = await Promise.all([
      getLowStockLines(200),
      StockLog.find(productId ? { product: productId } : {})
        .populate("product", "title slug")
        .populate("performedBy", "name email")
        .sort({ createdAt: -1 })
        .limit(200)
        .lean(),
    ]);

    return NextResponse.json({ lowStock, logs });
  } catch (err) {
    console.error("Inventory read error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

const adjustSchema = z.object({
  productId: z.string().min(1),
  variantKey: z.string().optional().default(""),
  /** Signed delta, or an absolute target when `mode` is "set". */
  quantity: z.number().int(),
  mode: z.enum(["delta", "set"]).default("delta"),
  note: z.string().max(500).optional(),
});

/**
 * Manual stock adjustment.
 *
 * "set" mode exists because a physical stock count produces an absolute number,
 * not a difference — asking staff to compute the delta themselves is how counts
 * get entered wrong. The delta is derived server-side and it is still the delta
 * that lands in the ledger, so the audit trail stays uniform.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, PERMISSIONS.INVENTORY);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const parsed = adjustSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    await connectDB();
    const { productId, variantKey, quantity, mode, note } = parsed.data;

    let delta = quantity;
    if (mode === "set") {
      const { Product } = await import("@/models");
      const product = await Product.findById(productId).lean<any>();
      if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

      const { stockForVariant } = await import("@/lib/inventory");
      const current = stockForVariant(product, variantKey);
      delta = quantity - current;
      if (delta === 0) {
        return NextResponse.json({ ok: true, resultingStock: current, unchanged: true });
      }
    }

    const result = await adjustStock({
      productId,
      variantKey,
      delta,
      reason: "manual_adjustment",
      note: note ?? (mode === "set" ? `Stock count set to ${quantity}` : ""),
      performedBy: admin.id,
    });

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    await logAdminAction({
      adminId: admin.id,
      action: "STOCK_ADJUST",
      targetType: "Product",
      targetId: productId,
      changes: { after: { variantKey, delta, resultingStock: result.resultingStock } },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ ok: true, resultingStock: result.resultingStock });
  } catch (err) {
    console.error("Stock adjust error:", err);
    return NextResponse.json({ error: "Could not adjust stock" }, { status: 500 });
  }
}
