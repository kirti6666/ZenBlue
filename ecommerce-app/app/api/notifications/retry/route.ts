import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/requireAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { retryFailedNotifications } from "@/lib/notifications/dispatch";

export const dynamic = "force-dynamic";

/**
 * Runs the retry sweep for failed notifications.
 *
 * Exposed as a route so it can be driven both by the admin button and by a
 * scheduled job (Vercel Cron, or any external scheduler hitting this URL) —
 * the quotation asks for automatic retry, and a cron calling this endpoint is
 * the deployment-agnostic way to provide it.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, PERMISSIONS.NOTIFICATIONS);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const result = await retryFailedNotifications(50);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Notification retry error:", err);
    return NextResponse.json({ error: "Retry sweep failed" }, { status: 500 });
  }
}
