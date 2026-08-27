import { NextRequest, NextResponse } from "next/server";
import { runAbandonedCartSweep } from "@/lib/abandonedCart";
import { retryFailedNotifications } from "@/lib/notifications/dispatch";
import { requireAdmin } from "@/lib/middleware/requireAdmin";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";
// Recovery sends and notification retries can both be slow; give the sweep room.
export const maxDuration = 60;

/**
 * Scheduled job: abandoned-cart recovery plus the notification retry sweep.
 *
 * Authorised two ways, because it has two callers:
 *  - a scheduler (Vercel Cron, GitHub Actions, any external pinger) presenting
 *    `Authorization: Bearer $CRON_SECRET`, compared in constant time, and
 *  - a signed-in admin who wants to run it on demand.
 *
 * When CRON_SECRET is unset the bearer path is refused outright rather than
 * left open — an unauthenticated endpoint that sends customer email is exactly
 * the kind of thing that gets abused.
 */
export async function POST(req: NextRequest) {
  const authorised = await isAuthorised(req);
  if (!authorised) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const [carts, notifications] = await Promise.all([
      runAbandonedCartSweep(100),
      retryFailedNotifications(50),
    ]);
    return NextResponse.json({ carts, notifications });
  } catch (err) {
    console.error("Cron sweep error:", err);
    return NextResponse.json({ error: "Sweep failed" }, { status: 500 });
  }
}

/** GET is accepted so schedulers that only issue GET requests can drive it. */
export async function GET(req: NextRequest) {
  return POST(req);
}

async function isAuthorised(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";

  if (secret && header.startsWith("Bearer ")) {
    const provided = header.slice(7);
    // Constant-time comparison — a plain === leaks the secret one byte at a
    // time to anyone able to measure the response.
    if (provided.length === secret.length) {
      let mismatch = 0;
      for (let i = 0; i < secret.length; i++) {
        mismatch |= provided.charCodeAt(i) ^ secret.charCodeAt(i);
      }
      if (mismatch === 0) return true;
    }
  }

  const admin = await requireAdmin(req, PERMISSIONS.MARKETING);
  return Boolean(admin);
}
