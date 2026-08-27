import { NextRequest, NextResponse } from "next/server";
import { consumeRecoveryToken } from "@/lib/abandonedCart";

export const dynamic = "force-dynamic";

/**
 * Redeems a single-use abandoned-cart restore token and returns the items for
 * the browser to rehydrate its cart with.
 *
 * Prices are returned as they were captured, but they are re-derived from the
 * database at checkout like every other line — so a stale recovery link can
 * never lock in an old price.
 */
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const result = await consumeRecoveryToken(token);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ items: result.items, cartToken: result.cartToken });
}
