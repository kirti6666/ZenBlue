import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { AbandonedCart } from "@/models";
import { getCurrentUser } from "@/lib/middleware/requireAuth";
import { getSiteSettings } from "@/lib/site-settings";
import { variantKey } from "@/lib/inventory";

const itemSchema = z.object({
  productId: z.string(),
  title: z.string().default(""),
  slug: z.string().default(""),
  image: z.string().optional().default(""),
  variant: z.record(z.string()).optional().default({}),
  quantity: z.number().int().min(1),
  price: z.number().min(0),
});

const syncSchema = z.object({
  cartToken: z.string().min(8).max(128),
  items: z.array(itemSchema).max(100),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  name: z.string().max(120).optional(),
});

/**
 * Cart snapshot endpoint, called by <CartSync /> whenever the browser cart
 * settles.
 *
 * Writes are upserts keyed on `cartToken`, so a shopper who edits their cart
 * ten times has exactly one row. If the cart is emptied we mark the row
 * `converted` rather than deleting it — an emptied cart is not a recovery
 * target, and keeping the row preserves the recovery attribution history.
 *
 * `lastActivityAt` is what the recovery sweep measures staleness against.
 */
export async function POST(req: NextRequest) {
  try {
    const parsed = syncSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const settings = await getSiteSettings();
    if (!settings.abandonedCart.enabled) return NextResponse.json({ ok: true, tracking: false });

    await connectDB();
    const user = await getCurrentUser(req);
    const { cartToken, items } = parsed.data;

    if (items.length === 0) {
      await AbandonedCart.findOneAndUpdate(
        { cartToken },
        { $set: { items: [], itemCount: 0, subtotal: 0, status: "converted", nextStepAt: null } }
      );
      return NextResponse.json({ ok: true });
    }

    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

    // The first nudge is scheduled from now; the sweep re-evaluates it on every
    // sync, so an active shopper keeps pushing their own reminder forward.
    const nextStepAt = new Date(
      Date.now() +
        (settings.abandonedCart.abandonAfterMinutes + settings.abandonedCart.step1AfterHours * 60) *
          60_000
    );

    await AbandonedCart.findOneAndUpdate(
      { cartToken },
      {
        $set: {
          items: items.map((i) => ({
            product: i.productId,
            title: i.title,
            slug: i.slug,
            image: i.image,
            variant: i.variant,
            variantKey: variantKey(i.variant),
            quantity: i.quantity,
            price: i.price,
          })),
          subtotal,
          itemCount,
          status: "active",
          lastActivityAt: new Date(),
          nextStepAt,
          ...(user ? { user: user.id, email: user.email } : {}),
          ...(parsed.data.email ? { email: parsed.data.email } : {}),
          ...(parsed.data.phone ? { phone: parsed.data.phone } : {}),
          ...(parsed.data.name ? { name: parsed.data.name } : {}),
        },
        $setOnInsert: { cartToken, recoveryToken: randomBytes(24).toString("hex") },
      },
      { upsert: true }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Cart sync error:", err);
    // Never fail loudly — this is a background convenience, not a shopper action.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
