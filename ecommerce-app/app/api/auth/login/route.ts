import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { loginSchema } from "@/lib/validations/auth";
import {
  signAccessToken,
  signRefreshToken,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  accessCookieOptions,
  refreshCookieOptions,
} from "@/lib/auth";
import { logAdminAction, getClientIp } from "@/lib/middleware/logAdminAction";
import { requestOtp } from "@/lib/otp";
import { isPhoneIdentifier } from "@/lib/otp";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    await connectDB();

    // password has `select: false` in the schema, so it must be explicitly requested
    const user = await User.findOne({ email }).select("+password");

    if (!user || !user.password) {
      // Same generic message whether the email doesn't exist or the password is wrong —
      // avoids leaking which emails are registered.
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    if (user.isBlocked) {
      return NextResponse.json(
        { error: "This account is not active — please contact support" },
        { status: 403 }
      );
    }

    // Two-factor: the password alone is not enough for a back-office account
    // with 2FA on. No session cookie is issued here — the caller must complete
    // /api/auth/2fa/verify, which re-checks the password-verified identity via
    // a single-use code before any token is minted.
    if (user.twoFactorEnabled && (user.role === "admin" || user.role === "staff")) {
      const channel =
        user.twoFactorChannel === "sms" && user.phone ? "sms" : ("email" as "sms" | "email");
      const identifier = channel === "sms" ? (user.phone as string) : user.email;

      const sent = await requestOtp({
        identifier,
        channel,
        purpose: "admin_2fa",
        ipAddress: getClientIp(req),
      });

      if (!sent.ok && !sent.retryAfter) {
        return NextResponse.json(
          { error: "Could not send your verification code — please try again" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        requiresTwoFactor: true,
        channel,
        // Masked so the operator knows where to look without the response
        // disclosing a full address or number.
        sentTo: maskIdentifier(identifier),
        identifier,
        undelivered: sent.undelivered,
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const payload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role as "customer" | "staff" | "admin",
      permissions: user.permissions ?? [],
    };
    const accessToken = await signAccessToken(payload);
    const refreshToken = await signRefreshToken(payload);

    const res = NextResponse.json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
    res.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, accessCookieOptions);
    res.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, refreshCookieOptions);

    if (user.role === "admin" || user.role === "staff") {
      await logAdminAction({
        adminId: user._id.toString(),
        action: "LOGIN",
        ipAddress: getClientIp(req),
      });
    }

    return res;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

/** j****@example.com / +91 ***** 43210 — enough to recognise, not to harvest. */
function maskIdentifier(value: string): string {
  if (isPhoneIdentifier(value)) {
    const digits = value.replace(/\D/g, "");
    return `••••• ${digits.slice(-5)}`;
  }
  const [name, domain] = value.split("@");
  if (!domain) return value;
  return `${name.slice(0, 1)}${"•".repeat(Math.max(2, name.length - 1))}@${domain}`;
}
