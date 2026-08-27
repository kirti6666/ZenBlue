import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { verifyOtp, isPhoneIdentifier } from "@/lib/otp";
import {
  signAccessToken,
  signRefreshToken,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  accessCookieOptions,
  refreshCookieOptions,
} from "@/lib/auth";
import { logAdminAction, getClientIp } from "@/lib/middleware/logAdminAction";

export const dynamic = "force-dynamic";

const schema = z.object({
  identifier: z.string().min(5).max(200),
  code: z.string().min(4).max(10),
  name: z.string().min(2).max(120).optional(),
  /** The "notify me with offers and updates" tick on the sign-in popup. */
  marketingOptIn: z.boolean().optional(),
});

/**
 * Verifies a passcode and signs the caller in, creating the account on first
 * use so a new customer never has to fill in a separate signup form.
 *
 * An account created this way has `provider: "otp"` and no password. That is
 * intentional: there is no password to leak, and the identifier is proven at
 * every sign-in rather than once at registration.
 */
export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const identifier = parsed.data.identifier.trim().toLowerCase();
    const isPhone = isPhoneIdentifier(identifier);

    const result = await verifyOtp({ identifier, code: parsed.data.code, purpose: "login" });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await connectDB();

    let user = await User.findOne(isPhone ? { phone: identifier } : { email: identifier });

    if (!user) {
      // A phone-only signup still needs an email field because it is unique and
      // required on the model; a placeholder keeps the record valid until the
      // customer adds a real one, and it can never receive mail.
      user = await User.create({
        name: parsed.data.name?.trim() || (isPhone ? "ZenBlue customer" : identifier.split("@")[0]),
        email: isPhone ? `${identifier}@phone.zenblue.local` : identifier,
        phone: isPhone ? identifier : undefined,
        phoneVerified: isPhone,
        provider: "otp",
        role: "customer",
        isVerified: !isPhone,
        marketingOptIn: parsed.data.marketingOptIn ?? false,
      });
    } else {
      if (isPhone) user.phoneVerified = true;
      else user.isVerified = true;
      // Only ever an opt IN from this form — an unticked box on a sign-in
      // popup is not a request to be unsubscribed from mail they already
      // agreed to, and treating it as one would silently drop consent.
      if (parsed.data.marketingOptIn) user.marketingOptIn = true;
      user.lastLoginAt = new Date();
      await user.save();
    }

    if (user.isBlocked) {
      return NextResponse.json(
        { error: "This account is not active — please contact support" },
        { status: 403 }
      );
    }

    // A one-time code is a single possession factor. For a customer that is a
    // complete sign-in; for a back-office account with two-factor enabled it is
    // only HALF of what is required, and issuing a session here would let the
    // OTP path walk straight around the password. Those accounts must sign in
    // with their password, which then runs its own 2FA challenge.
    if (
      (user.role === "admin" || user.role === "staff") &&
      user.twoFactorEnabled
    ) {
      return NextResponse.json(
        {
          error:
            "This account has two-factor authentication enabled — please sign in with your password.",
        },
        { status: 403 }
      );
    }

    const claims = {
      userId: String(user._id),
      email: user.email,
      role: user.role as "customer" | "staff" | "admin",
      permissions: user.permissions ?? [],
    };

    const res = NextResponse.json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
    res.cookies.set(ACCESS_TOKEN_COOKIE, await signAccessToken(claims), accessCookieOptions);
    res.cookies.set(REFRESH_TOKEN_COOKIE, await signRefreshToken(claims), refreshCookieOptions);

    if (user.role === "admin" || user.role === "staff") {
      await logAdminAction({
        adminId: String(user._id),
        action: "LOGIN",
        targetType: "User",
        targetId: String(user._id),
        changes: { after: { method: "otp" } },
        ipAddress: getClientIp(req),
      });
    }

    return res;
  } catch (err) {
    console.error("OTP verify error:", err);
    return NextResponse.json({ error: "Could not verify that code" }, { status: 500 });
  }
}
