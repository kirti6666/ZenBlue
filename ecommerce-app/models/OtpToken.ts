import { createHash } from "crypto";
import { Schema, models, model } from "mongoose";

/**
 * OtpToken — short-lived one-time codes for passwordless login/signup, order
 * verification, and admin two-factor.
 *
 * The code is never stored in plain text: only a SHA-256 hash is persisted, so
 * a database leak cannot be replayed against a live OTP. Rows self-delete via
 * a TTL index on `expiresAt`, which keeps the collection from growing without
 * bound and guarantees an unused code stops working even if nothing sweeps it.
 */

const OtpTokenSchema = new Schema(
  {
    /** Email address or E.164 phone, depending on `channel`. */
    identifier: { type: String, required: true, index: true },
    channel: { type: String, enum: ["email", "sms"], default: "email" },
    purpose: {
      type: String,
      enum: ["login", "signup", "order_verify", "admin_2fa"],
      default: "login",
      index: true,
    },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    /** Wrong guesses; the token is burned once this hits the cap. */
    attempts: { type: Number, default: 0 },
    consumedAt: { type: Date },
    ipAddress: { type: String, default: "" },
  },
  { timestamps: true }
);

/** TTL sweep — MongoDB removes the row once `expiresAt` passes. */
OtpTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export function hashOtp(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export default models.OtpToken || model("OtpToken", OtpTokenSchema);
