import { NextRequest, NextResponse } from "next/server";
import {
  isErpConfigured,
  pushOrdersToErp,
  syncCustomersFromErp,
  syncDispatchFromErp,
  syncOrderStatusFromErp,
  syncPricesFromErp,
  syncProductsFromErp,
  syncReturnsFromErp,
  syncStockFromErp,
} from "@/lib/erp/client";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Scheduled ERP reconciliation. Sale creation remains an explicit opt-in. */
export async function GET(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!isErpConfigured()) return NextResponse.json({ error: "ERP is not configured" }, { status: 400 });

  try {
    const result: Record<string, unknown> = {};
    result.products = await syncProductsFromErp();
    result.prices = await syncPricesFromErp();
    result.stock = await syncStockFromErp();
    result.customers = await syncCustomersFromErp();
    result.order_status = await syncOrderStatusFromErp();
    result.dispatch = await syncDispatchFromErp();
    result.returns = await syncReturnsFromErp();
    if (process.env.ERP_AUTO_PUSH_ORDERS?.toLowerCase() === "true") {
      result.push_orders = await pushOrdersToErp();
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("Scheduled ERP sync failed:", error);
    return NextResponse.json({ error: "Scheduled ERP sync failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}

function authorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  const provided = header.slice(7);
  if (provided.length !== secret.length) return false;
  let mismatch = 0;
  for (let index = 0; index < secret.length; index += 1) {
    mismatch |= provided.charCodeAt(index) ^ secret.charCodeAt(index);
  }
  return mismatch === 0;
}
