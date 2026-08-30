import { Schema, model, models } from "mongoose";

/**
 * One-use password recovery token. Only a SHA-256 digest is stored, so a
 * database read cannot reveal a usable reset link. MongoDB removes expired
 * rows automatically through the TTL index.
 */
const PasswordResetTokenSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true },
    ipAddress: { type: String, default: "" },
  },
  { timestamps: true }
);

PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default models.PasswordResetToken ||
  model("PasswordResetToken", PasswordResetTokenSchema);

