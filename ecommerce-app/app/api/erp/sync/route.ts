import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/requireAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { logAdminAction, getClientIp } from "@/lib/middleware/logAdminAction";
import {
  getOrderPushReadiness,
  isErpConfigured,
  pingErp,
  probeErpScopes,
  pushOrdersToErp,
  syncCustomersFromErp,
  syncOrderStatusFromErp,
  syncProductsFromErp,
  syncReturnsFromErp,
  syncStockFromErp,
  syncPricesFromErp,
  syncDispatchFromErp,
} from "@/lib/erp/client";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Connection status for the admin screen. */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, PERMISSIONS.SETTINGS);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!isErpConfigured()) {
    return NextResponse.json({
      configured: false,
      message: "Set ERP_BASE_URL and ERP_API_KEY to enable the integration.",
    });
  }

  const ping = await pingErp();
  const scopes = ping.ok ? await probeErpScopes() : [];
  return NextResponse.json({
    configured: true,
    reachable: ping.ok,
    error: ping.error,
    scopes,
    orderPush: getOrderPushReadiness(),
  });
}

/**
 * Runs one ERP sync.
 *
 * Each direction is a separate operation rather than one "sync everything"
 * button, because they fail independently and an operator needs to know which
 * one broke. Order matters when running all: prices before stock, so a product
 * whose price changed is already correct when its level is adjusted.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, PERMISSIONS.SETTINGS);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!isErpConfigured()) {
    return NextResponse.json(
      { error: "ERP is not configured — set ERP_BASE_URL and ERP_API_KEY" },
      { status: 400 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const operation = String((body as any).operation ?? "all");

    const operations: Record<string, () => Promise<unknown>> = {
      products: syncProductsFromErp,
      prices: syncPricesFromErp,
      stock: syncStockFromErp,
      customers: syncCustomersFromErp,
      order_status: syncOrderStatusFromErp,
      push_orders: pushOrdersToErp,
      dispatch: syncDispatchFromErp,
      returns: syncReturnsFromErp,
    };
    const result: Record<string, unknown> = {};

    if (operation === "all") {
      // Deliberately excludes push_orders: Run all is safe to repeat and only
      // pulls/reconciles. Creating accounting invoices always needs a separate
      // explicit click from the operator.
      for (const key of ["products", "prices", "stock", "customers", "order_status", "dispatch", "returns"]) {
        result[key] = await operations[key]();
      }
    } else if (operations[operation]) {
      result[operation] = await operations[operation]();
    } else {
      return NextResponse.json({ error: `Unknown ERP operation: ${operation}` }, { status: 400 });
    }

    await logAdminAction({
      adminId: admin.id,
      action: "MARKETING_ACTION",
      targetType: "Settings",
      changes: { after: { erpSync: operation, result } },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("ERP sync error:", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
