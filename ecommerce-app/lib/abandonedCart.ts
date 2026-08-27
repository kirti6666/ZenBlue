import { randomBytes } from "crypto";
import { connectDB } from "@/lib/db";
import { AbandonedCart, NotificationLog } from "@/models";
import { getSiteSettings, formatPrice, type SiteSettingsData } from "@/lib/site-settings";
import { sendViaEmail, sendViaSms, sendViaWhatsApp } from "@/lib/notifications/providers";
import { emailShell } from "@/lib/notifications/templates";
import { absoluteUrl } from "@/lib/seo";

/**
 * Abandoned-cart recovery sequence.
 *
 * Runs as a sweep rather than a per-cart timer: a scheduled job calls
 * `runAbandonedCartSweep()`, which finds carts that are due for their next
 * nudge and sends it. That is the only shape that survives a serverless
 * deployment, where nothing keeps a timer alive between requests.
 *
 * Three guards keep the sequence honest:
 *  - a cart is only contactable if we captured an email or phone,
 *  - the sequence exits the moment the cart converts or is emptied, and
 *  - the incentive coupon is held back to a later step, so shoppers are not
 *    trained to abandon carts on purpose.
 */

const MAX_STEPS = 3;

export interface SweepResult {
  examined: number;
  sent: number;
  skipped: number;
  errors: number;
}

/** Hours after abandonment at which each step fires. */
function stepDelayHours(settings: SiteSettingsData, step: number): number {
  if (step === 1) return settings.abandonedCart.step1AfterHours;
  if (step === 2) return settings.abandonedCart.step2AfterHours;
  return settings.abandonedCart.step3AfterHours;
}

export async function runAbandonedCartSweep(limit = 100): Promise<SweepResult> {
  await connectDB();
  const settings = await getSiteSettings();

  const result: SweepResult = { examined: 0, sent: 0, skipped: 0, errors: 0 };
  if (!settings.abandonedCart.enabled) return result;

  const idleCutoff = new Date(
    Date.now() - settings.abandonedCart.abandonAfterMinutes * 60_000
  );

  // Candidates: carts with items, not yet converted, idle long enough, and
  // still with steps left to send.
  const carts = await AbandonedCart.find({
    status: { $in: ["active", "abandoned"] },
    itemCount: { $gt: 0 },
    lastActivityAt: { $lte: idleCutoff },
  })
    .sort({ lastActivityAt: 1 })
    .limit(limit);

  for (const cart of carts) {
    result.examined += 1;

    try {
      const stepsSent = cart.stepsSent?.length ?? 0;
      if (stepsSent >= MAX_STEPS) {
        cart.status = "expired";
        cart.nextStepAt = null;
        await cart.save();
        result.skipped += 1;
        continue;
      }

      // No contact details captured — nothing we can do, and it is not an error.
      if (!cart.email && !cart.phone) {
        cart.status = "abandoned";
        await cart.save();
        result.skipped += 1;
        continue;
      }

      const nextStep = stepsSent + 1;
      const dueAt = new Date(
        new Date(cart.lastActivityAt).getTime() +
          settings.abandonedCart.abandonAfterMinutes * 60_000 +
          stepDelayHours(settings, nextStep) * 3_600_000
      );

      if (Date.now() < dueAt.getTime()) {
        cart.nextStepAt = dueAt;
        await cart.save();
        result.skipped += 1;
        continue;
      }

      // Mint a fresh single-use restore token for this send.
      cart.recoveryToken = randomBytes(24).toString("hex");
      cart.recoveryTokenExpiresAt = new Date(
        Date.now() + settings.abandonedCart.recoveryLinkExpiryHours * 3_600_000
      );

      const couponCode =
        nextStep >= settings.abandonedCart.incentiveFromStep
          ? settings.abandonedCart.incentiveCouponCode
          : "";

      const sent = await sendRecoveryMessage({
        cart,
        settings,
        step: nextStep,
        couponCode,
      });

      cart.status = "abandoned";
      cart.stepsSent = [
        ...(cart.stepsSent ?? []),
        { step: nextStep, channel: sent.channel, sentAt: new Date(), couponCode },
      ];
      cart.nextStepAt =
        nextStep < MAX_STEPS
          ? new Date(
              new Date(cart.lastActivityAt).getTime() +
                settings.abandonedCart.abandonAfterMinutes * 60_000 +
                stepDelayHours(settings, nextStep + 1) * 3_600_000
            )
          : null;
      await cart.save();

      if (sent.ok) result.sent += 1;
      else result.errors += 1;
    } catch (err) {
      console.error("[abandoned-cart] sweep error:", err);
      result.errors += 1;
    }
  }

  return result;
}

async function sendRecoveryMessage(opts: {
  cart: any;
  settings: SiteSettingsData;
  step: number;
  couponCode: string;
}): Promise<{ ok: boolean; channel: "email" | "whatsapp" | "sms" }> {
  const { cart, settings, step, couponCode } = opts;
  const symbol = settings.commerce.currencySymbol;
  const toggles = settings.notifications.abandonedCart;

  const restoreUrl = absoluteUrl(`/cart/restore?token=${cart.recoveryToken}`);
  const firstName = (cart.name || "").split(" ")[0] || "there";

  const headline =
    step === 1
      ? "You left something behind"
      : step === 2
        ? "Still thinking it over?"
        : "Last chance on your cart";

  const itemsHtml = (cart.items ?? [])
    .slice(0, 4)
    .map(
      (item: any) => `<tr>
        <td style="padding:8px 0;font-size:13px;border-bottom:1px solid #DEE2E6;">
          ${escapeHtml(item.title)}${item.variantKey ? `<br><span style="color:#626B76;font-size:12px;">${escapeHtml(item.variantKey)}</span>` : ""}
        </td>
        <td style="padding:8px 0;font-size:13px;text-align:right;border-bottom:1px solid #DEE2E6;">
          ${formatPrice(item.price * item.quantity, symbol)}
        </td>
      </tr>`
    )
    .join("");

  let ok = false;
  let channel: "email" | "whatsapp" | "sms" = "email";

  if (toggles.email && cart.email) {
    channel = "email";
    const res = await sendViaEmail({
      to: cart.email,
      subject:
        step === 3 && couponCode
          ? `${headline} — here's ${couponCode}`
          : `${headline}, ${firstName}`,
      html: emailShell({
        storeName: settings.brand.storeName,
        heading: headline,
        intro:
          step === 1
            ? "Your cart is still saved. Pick up exactly where you left off."
            : step === 2
              ? "These are still waiting for you — but sizes move quickly."
              : "We are holding your cart a little longer. After this it clears.",
        bodyHtml:
          `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0;">${itemsHtml}</table>` +
          (couponCode
            ? `<p style="margin:16px 0 0;padding:12px;background:#EFEEEA;border-radius:8px;font-size:14px;color:#16233B;">
                 Use code <strong>${escapeHtml(couponCode)}</strong> at checkout.
               </p>`
            : ""),
        ctaText: "Return to my cart",
        ctaUrl: restoreUrl,
        footerNote:
          "You are receiving this because you left items in your cart. This link works once.",
      }),
    });
    ok = res.ok;

    await NotificationLog.create({
      event: `abandoned_cart_${step}`,
      channel: "email",
      recipient: cart.email,
      user: cart.user,
      subject: headline,
      preview: `${cart.itemCount} items · ${formatPrice(cart.subtotal, symbol)}`,
      status: res.ok ? "sent" : res.skipped ? "skipped" : "failed",
      attempts: 1,
      lastAttemptAt: new Date(),
      error: res.error ?? "",
    }).catch(() => undefined);
  }

  // WhatsApp and SMS are only attempted when email was not available or not
  // enabled — three channels for one abandoned cart is spam, not marketing.
  if (!ok && toggles.whatsapp && cart.phone) {
    channel = "whatsapp";
    const res = await sendViaWhatsApp({
      to: cart.phone,
      templateName: process.env.WHATSAPP_TEMPLATE_ABANDONED_CART ?? "abandoned_cart",
      bodyParams: [firstName, formatPrice(cart.subtotal, symbol), restoreUrl],
    });
    ok = res.ok;
  }

  if (!ok && toggles.sms && cart.phone) {
    channel = "sms";
    const res = await sendViaSms({
      to: cart.phone,
      templateId: process.env.SMS_TEMPLATE_ABANDONED_CART ?? "",
      variables: { name: firstName, url: restoreUrl },
      fallbackText: `${settings.brand.storeName}: your cart is still saved. ${restoreUrl}`,
    });
    ok = res.ok;
  }

  return { ok, channel };
}

/**
 * Consumes a restore token and returns the cart to rehydrate.
 *
 * Single use: the token is cleared as soon as it is redeemed, so a forwarded
 * link cannot repopulate a second person's browser with someone else's cart.
 */
export async function consumeRecoveryToken(token: string) {
  await connectDB();

  const cart = await AbandonedCart.findOne({ recoveryToken: token });
  if (!cart) return { ok: false as const, error: "This link is no longer valid" };

  if (cart.recoveryTokenExpiresAt && cart.recoveryTokenExpiresAt < new Date()) {
    return { ok: false as const, error: "This link has expired" };
  }

  const items = (cart.items ?? []).map((item: any) => ({
    productId: String(item.product),
    title: item.title,
    slug: item.slug,
    image: item.image,
    variant: item.variant instanceof Map ? Object.fromEntries(item.variant) : (item.variant ?? {}),
    quantity: item.quantity,
    price: item.price,
  }));

  cart.recoveryToken = undefined;
  cart.recoveryTokenExpiresAt = undefined;
  cart.recoveredAt = new Date();
  cart.recoveredByStep = cart.stepsSent?.length ?? 0;
  cart.lastActivityAt = new Date();
  await cart.save();

  return { ok: true as const, items, cartToken: cart.cartToken };
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
