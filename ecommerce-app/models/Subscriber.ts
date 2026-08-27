import { Schema, models, model } from "mongoose";

/**
 * Subscriber — newsletter signups from the footer and any campaign form.
 *
 * `unsubscribeToken` is generated at signup so every marketing email can carry
 * a working one-click unsubscribe link without the recipient needing an
 * account. Rows are never deleted on unsubscribe — the status flips — so a
 * re-import can't silently resurrect someone who opted out.
 */

const SubscriberSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, default: "" },
    source: { type: String, default: "footer" },
    status: { type: String, enum: ["subscribed", "unsubscribed"], default: "subscribed", index: true },
    unsubscribeToken: { type: String, index: true },
    unsubscribedAt: { type: Date },
  },
  { timestamps: true }
);

export default models.Subscriber || model("Subscriber", SubscriberSchema);
