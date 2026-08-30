import { createHash, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getClientIp } from "@/lib/middleware/logAdminAction";
import { sendViaEmail } from "@/lib/notifications/providers";
import { emailShell } from "@/lib/notifications/templates";
import { siteUrl } from "@/lib/seo";
import { getSiteSettings } from "@/lib/site-settings";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { PasswordResetToken, User } from "@/models";

export const dynamic = "force-dynamic";

const GENERIC_MESSAGE =
  "If an account exists for that email, a password reset link has been sent.";
const RESET_TTL_MS = 30 * 60 * 1000;

function isLocalOrigin(origin: string) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

/**
 * A link emailed to a phone must never point at localhost—the phone would try
 * to open a server on itself. In production the actual request host wins, so
 * even a stale Vercel environment value cannot poison reset links. During
 * local testing we deliberately use the configured public storefront URL.
 */
function passwordResetOrigin(req: NextRequest) {
  const requestOrigin = req.nextUrl.origin.replace(/\/+$/, "");
  if (!isLocalOrigin(requestOrigin)) return requestOrigin;

  const configuredOrigin = siteUrl();
  return isLocalOrigin(configuredOrigin) ? requestOrigin : configuredOrigin;
}

export async function POST(req: NextRequest) {
  try {
    const parsed = forgotPasswordSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    await connectDB();
    const user = await User.findOne({
      email: parsed.data.email,
      isBlocked: { $ne: true },
    }).select("_id name email");

    // Always return the same message so this route cannot enumerate accounts.
    if (!user) return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });

    // Ignore repeated clicks for one minute without changing the public result.
    const recent = await PasswordResetToken.findOne({
      user: user._id,
      createdAt: { $gte: new Date(Date.now() - 60_000) },
    }).select("_id");
    if (recent) return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });

    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await PasswordResetToken.deleteMany({ user: user._id });
    await PasswordResetToken.create({
      user: user._id,
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
      ipAddress: getClientIp(req),
    });

    const settings = await getSiteSettings();
    const resetUrl = `${passwordResetOrigin(req)}/reset-password?token=${token}`;
    const result = await sendViaEmail({
      to: user.email,
      subject: `Reset your ${settings.brand.storeName} password`,
      html: emailShell({
        storeName: settings.brand.storeName,
        heading: "Reset your password",
        intro: `Hi ${user.name?.split(" ")[0] || "there"}, we received a request to reset your password. This secure link expires in 30 minutes and works only once.`,
        ctaText: "Reset password",
        ctaUrl: resetUrl,
        footerNote: `If you did not request this, you can safely ignore this email. Need help? Write to ${
          settings.contact.supportEmail || settings.contact.email
        }.`,
      }),
    });

    if (!result.ok) {
      console.error("Password reset email was not sent:", result.error);
    }
    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Could not process the request right now" }, { status: 500 });
  }
}
