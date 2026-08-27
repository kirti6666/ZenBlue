import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { verifyOtp } from "@/lib/otp";
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
  email: z.string().email(),
  password: z.string().min(1),
  identifier: z.string().min(3),
  code: z.string().min(4).max(10),
});

/**
 * Completes a two-factor sign-in and issues the session.
 *
 * The password is re-verified here rather than trusting a short-lived
 * "pending 2FA" token. That means possession of a valid code alone is never
 * enough — an attacker who intercepts the SMS still needs the password, which
 * is the entire point of the second factor. It costs one bcrypt comparison on
 * a path that runs at most a few times a day.
 */
export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    await connectDB();
    const user = await User.findOne({ email: parsed.data.email.toLowerCase() }).select("+password");

    const invalid = NextResponse.json({ error: "Verification failed" }, { status: 401 });
    if (!user || !user.password) return invalid;

    const passwordOk = await bcrypt.compare(parsed.data.password, user.password);
    if (!passwordOk) return invalid;
    if (user.isBlocked) {
      return NextResponse.json({ error: "This account is not active" }, { status: 403 });
    }

    const result = await verifyOtp({
      identifier: parsed.data.identifier,
      code: parsed.data.code,
      purpose: "admin_2fa",
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    user.lastLoginAt = new Date();
    await user.save();

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

    await logAdminAction({
      adminId: String(user._id),
      action: "LOGIN",
      changes: { after: { twoFactor: true } },
      ipAddress: getClientIp(req),
    });

    return res;
  } catch (err) {
    console.error("2FA verify error:", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
