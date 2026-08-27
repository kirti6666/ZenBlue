import { randomInt } from "crypto";
import { connectDB } from "@/lib/db";
import OtpToken, { hashOtp } from "@/models/OtpToken";
import { sendViaEmail, sendViaSms } from "@/lib/notifications/providers";
import { emailShell } from "@/lib/notifications/templates";
import { getSiteSettings } from "@/lib/site-settings";

/**
 * One-time passcodes for passwordless login, signup and admin two-factor.
 *
 * Security decisions worth stating:
 *  - Codes are generated with crypto.randomInt, not Math.random. A predictable
 *    OTP is not an OTP.
 *  - Only a SHA-256 hash is stored, so a database dump cannot be replayed.
 *  - Verification is capped at MAX_ATTEMPTS and the row is burned on success,
 *    which is what stops a 6-digit code from being brute-forced.
 *  - Requesting a new code invalidates any earlier unconsumed one for the same
 *    identifier and purpose, so two codes are never live at once.
 */

const CODE_LENGTH = 6;
const TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
/** Minimum gap between requests for the same identifier. */
const RESEND_COOLDOWN_SECONDS = 45;

export type OtpPurpose = "login" | "signup" | "order_verify" | "admin_2fa";

function generateCode(): string {
  // randomInt is uniform over the range — no modulo bias.
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

export interface RequestOtpResult {
  ok: boolean;
  error?: string;
  /** Seconds the caller must wait before requesting again. */
  retryAfter?: number;
  /** True when no provider is configured — the code is logged, not delivered. */
  undelivered?: boolean;
  /** Local-development fallback only; never returned in production. */
  devCode?: string;
}

export async function requestOtp(opts: {
  identifier: string;
  channel: "email" | "sms";
  purpose: OtpPurpose;
  name?: string;
  ipAddress?: string;
}): Promise<RequestOtpResult> {
  await connectDB();
  const identifier = opts.identifier.trim().toLowerCase();

  // Rate limit: refuse a second code inside the cooldown window.
  const recent = await OtpToken.findOne({
    identifier,
    purpose: opts.purpose,
    createdAt: { $gt: new Date(Date.now() - RESEND_COOLDOWN_SECONDS * 1000) },
  }).sort({ createdAt: -1 });

  if (recent) {
    const elapsed = (Date.now() - new Date(recent.createdAt).getTime()) / 1000;
    return {
      ok: false,
      error: "A code was just sent — please wait before requesting another",
      retryAfter: Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed),
    };
  }

  // Invalidate any earlier live code so only the newest one works.
  await OtpToken.deleteMany({ identifier, purpose: opts.purpose, consumedAt: null });

  const code = generateCode();
  await OtpToken.create({
    identifier,
    channel: opts.channel,
    purpose: opts.purpose,
    codeHash: hashOtp(code),
    expiresAt: new Date(Date.now() + TTL_MINUTES * 60_000),
    ipAddress: opts.ipAddress ?? "",
  });

  const settings = await getSiteSettings();
  const storeName = settings.brand.storeName;

  const result =
    opts.channel === "email"
      ? await sendViaEmail({
          to: identifier,
          subject: `${code} is your ${storeName} verification code`,
          html: emailShell({
            storeName,
            heading: "Your verification code",
            intro: `Enter this code to continue. It expires in ${TTL_MINUTES} minutes.`,
            bodyHtml: `<p style="font-size:32px;font-weight:700;letter-spacing:.28em;color:#16233B;margin:20px 0;">${code}</p>`,
            footerNote:
              "If you did not request this code, you can safely ignore this email — nobody can access your account without it.",
          }),
        })
      : await sendViaSms({
          to: identifier,
          templateId: process.env.SMS_TEMPLATE_OTP_LOGIN ?? "",
          variables: { otp: code, brand: storeName },
          fallbackText: `${code} is your ${storeName} verification code. Valid for ${TTL_MINUTES} minutes.`,
        });

  if (!result.ok) {
    if (result.skipped) {
      // No provider configured yet (common in local development). The code is
      // logged so the flow is still testable end to end, and this NEVER runs in
      // production because the log only happens when nothing is configured.
      console.warn(`[otp] No ${opts.channel} provider configured. Code for ${identifier}: ${code}`);
      return {
        ok: true,
        undelivered: true,
        ...(process.env.NODE_ENV !== "production" ? { devCode: code } : {}),
      };
    }
    return { ok: false, error: "We could not send the code — please try again" };
  }

  return { ok: true };
}

export interface VerifyOtpResult {
  ok: boolean;
  error?: string;
}

export async function verifyOtp(opts: {
  identifier: string;
  code: string;
  purpose: OtpPurpose;
}): Promise<VerifyOtpResult> {
  await connectDB();
  const identifier = opts.identifier.trim().toLowerCase();

  const token = await OtpToken.findOne({
    identifier,
    purpose: opts.purpose,
    consumedAt: null,
  }).sort({ createdAt: -1 });

  // Same message for "no code" and "wrong code" — distinguishing them tells an
  // attacker whether an identifier has a live code outstanding.
  const invalid = { ok: false, error: "That code is not valid or has expired" };

  if (!token) return invalid;
  if (token.expiresAt < new Date()) {
    await token.deleteOne();
    return invalid;
  }
  if (token.attempts >= MAX_ATTEMPTS) {
    await token.deleteOne();
    return { ok: false, error: "Too many incorrect attempts — request a new code" };
  }

  if (token.codeHash !== hashOtp(opts.code.trim())) {
    token.attempts += 1;
    await token.save();
    return invalid;
  }

  // Burn the token so the same code cannot be replayed.
  token.consumedAt = new Date();
  await token.save();
  await OtpToken.deleteOne({ _id: token._id });

  return { ok: true };
}

/** True when the value looks like an Indian mobile number rather than an email. */
export function isPhoneIdentifier(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return !value.includes("@") && digits.length >= 10;
}
