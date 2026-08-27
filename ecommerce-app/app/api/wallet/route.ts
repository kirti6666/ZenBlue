import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/middleware/requireAuth";
import { requireAdmin } from "@/lib/middleware/requireAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { logAdminAction, getClientIp } from "@/lib/middleware/logAdminAction";
import { creditWallet, debitWallet, getWalletBalance, getWalletLedger } from "@/lib/wallet";

// Reads cookies/query params per request — never statically rendered.
export const dynamic = "force-dynamic";

/**
 * Store-credit wallet.
 *
 * GET without `userId` returns the caller's own balance and ledger.
 * GET with `userId` is admin-only — otherwise any customer could read anyone
 * else's transaction history by guessing an id.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ error: "Please log in" }, { status: 401 });

    const requestedId = new URL(req.url).searchParams.get("userId");

    let targetId = user.id;
    if (requestedId && requestedId !== user.id) {
      const admin = await requireAdmin(req, PERMISSIONS.WALLET);
      if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      targetId = requestedId;
    }

    const [balance, ledger] = await Promise.all([
      getWalletBalance(targetId),
      getWalletLedger(targetId),
    ]);

    return NextResponse.json({ balance, ledger });
  } catch (err) {
    console.error("Wallet read error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

const adjustSchema = z.object({
  userId: z.string().min(1),
  /** Signed: positive issues credit, negative deducts it. */
  amount: z.number().refine((n) => n !== 0, "Amount cannot be zero"),
  reason: z.enum(["goodwill", "promotion", "manual_adjustment", "expiry"]).default("manual_adjustment"),
  note: z.string().max(500).optional(),
});

/** Admin issues or deducts store credit manually. */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, PERMISSIONS.WALLET);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const parsed = adjustSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    await connectDB();
    const { userId, amount, reason, note } = parsed.data;

    const result =
      amount > 0
        ? await creditWallet({ userId, amount, reason, note, performedBy: admin.id })
        : await debitWallet({ userId, amount: Math.abs(amount), reason, note, performedBy: admin.id });

    await logAdminAction({
      adminId: admin.id,
      action: "WALLET_ADJUST",
      targetType: "Wallet",
      targetId: userId,
      changes: { after: { amount, reason, note } },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ balance: result.balance });
  } catch (err) {
    // debitWallet throws rather than overdrawing — surface that as a 400.
    const message = err instanceof Error ? err.message : "Could not adjust the wallet";
    console.error("Wallet adjust error:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
