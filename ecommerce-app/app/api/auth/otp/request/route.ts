import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { requestOtp, isPhoneIdentifier } from "@/lib/otp";
import { getClientIp } from "@/lib/middleware/logAdminAction";

export const dynamic = "force-dynamic";

const schema = z.object({
  identifier: z.string().min(5, "Enter your email or phone number").max(200),
  purpose: z.enum(["login", "signup", "admin_2fa"]).default("login"),
});

/**
 * Sends a one-time passcode for passwordless sign-in.
 *
 * The response is identical whether or not an account exists. Saying "no
 * account found" would turn this endpoint into a way to enumerate which emails
 * and phone numbers are registered — and it is unnecessary, because the verify
 * step creates an account when none exists.
 */
export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const identifier = parsed.data.identifier.trim().toLowerCase();
    const channel = isPhoneIdentifier(identifier) ? "sms" : "email";

    if (channel === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(identifier)) {
      return NextResponse.json({ error: "Enter a valid email or phone number" }, { status: 400 });
    }

    // A blocked account must not be able to sign itself back in with an OTP.
    await connectDB();
    const existing = await User.findOne(
      channel === "email" ? { email: identifier } : { phone: identifier }
    ).select("isBlocked");

    if (existing?.isBlocked) {
      // Deliberately the same generic success shape — see the note above.
      return NextResponse.json({ ok: true, channel });
    }

    const result = await requestOtp({
      identifier,
      channel,
      purpose: parsed.data.purpose,
      ipAddress: getClientIp(req),
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, retryAfter: result.retryAfter },
        { status: 429 }
      );
    }

    return NextResponse.json({
      ok: true,
      channel,
      undelivered: result.undelivered,
      ...(process.env.NODE_ENV !== "production" && result.devCode
        ? { devCode: result.devCode }
        : {}),
    });
  } catch (err) {
    console.error("OTP request error:", err);
    return NextResponse.json({ error: "Could not send a code right now" }, { status: 500 });
  }
}
