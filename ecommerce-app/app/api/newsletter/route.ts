import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Subscriber } from "@/models";
import { requireAdmin } from "@/lib/middleware/requireAdmin";
import { PERMISSIONS } from "@/lib/permissions";

// Reads cookies/query params per request — never statically rendered.
export const dynamic = "force-dynamic";

const subscribeSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  name: z.string().max(120).optional(),
  source: z.string().max(60).optional(),
});

/**
 * Newsletter signup.
 *
 * Idempotent by design: subscribing an address that already exists returns the
 * same success response as a fresh signup rather than "already subscribed".
 * Telling an anonymous visitor which addresses are on the list would be an
 * enumeration oracle, and the distinction is of no use to the subscriber.
 */
export async function POST(req: NextRequest) {
  try {
    const parsed = subscribeSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    await connectDB();
    const email = parsed.data.email.toLowerCase().trim();

    await Subscriber.findOneAndUpdate(
      { email },
      {
        $set: {
          status: "subscribed",
          unsubscribedAt: null,
          ...(parsed.data.name ? { name: parsed.data.name } : {}),
        },
        $setOnInsert: {
          email,
          source: parsed.data.source ?? "footer",
          unsubscribeToken: randomBytes(24).toString("hex"),
        },
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Newsletter subscribe error:", err);
    return NextResponse.json({ error: "Could not subscribe right now" }, { status: 500 });
  }
}

/** Admin: list subscribers for the marketing screen and CSV export. */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, PERMISSIONS.MARKETING);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await connectDB();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const subscribers = await Subscriber.find(status ? { status } : {})
    .sort({ createdAt: -1 })
    .limit(2000)
    .lean();

  return NextResponse.json({ subscribers, total: subscribers.length });
}

/** One-click unsubscribe from a marketing email's footer link. */
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  await connectDB();
  const sub = await Subscriber.findOneAndUpdate(
    { unsubscribeToken: token },
    { $set: { status: "unsubscribed", unsubscribedAt: new Date() } }
  );

  if (!sub) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
