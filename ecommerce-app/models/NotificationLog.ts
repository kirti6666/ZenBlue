import { Schema, models, model } from "mongoose";

/**
 * NotificationLog — one row per message the system attempted to send, across
 * email, WhatsApp and SMS.
 *
 * The quotation requires "per-message send status logged with automatic retry
 * on failure", which is exactly what this table is for: the send helpers write
 * a row before dispatching, mark it sent/failed after, and a retry sweep picks
 * up rows in `failed` with `attempts` under the cap.
 *
 * It doubles as the audit trail when a customer says "I never got my tracking
 * link" — admin can see whether it was sent, to which address, and why it
 * failed.
 */

export const NOTIFICATION_EVENTS = [
  "order_placed",
  "payment_confirmed",
  "order_confirmed",
  "order_shipped",
  "out_for_delivery",
  "order_delivered",
  "order_cancelled",
  "return_requested",
  "return_approved",
  "return_rejected",
  "refund_issued",
  "store_credit_issued",
  "abandoned_cart_1",
  "abandoned_cart_2",
  "abandoned_cart_3",
  "back_in_stock",
  "otp_login",
  "admin_2fa",
  "welcome",
  "newsletter_welcome",
] as const;

const NotificationLogSchema = new Schema(
  {
    event: { type: String, enum: NOTIFICATION_EVENTS, required: true, index: true },
    channel: { type: String, enum: ["email", "whatsapp", "sms"], required: true, index: true },

    /** Email address or E.164 phone number, depending on channel. */
    recipient: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", index: true },
    order: { type: Schema.Types.ObjectId, ref: "Order", index: true },

    subject: { type: String, default: "" },
    /** Rendered body, truncated — enough to prove what was sent. */
    preview: { type: String, default: "" },
    /** Provider template id (WhatsApp/DLT SMS require pre-approved templates). */
    templateName: { type: String, default: "" },

    status: {
      type: String,
      enum: ["queued", "sent", "failed", "skipped"],
      default: "queued",
      index: true,
    },
    attempts: { type: Number, default: 0 },
    lastAttemptAt: { type: Date },
    error: { type: String, default: "" },
    /** Provider message id, for reconciling delivery reports. */
    providerMessageId: { type: String, default: "" },
  },
  { timestamps: true }
);

NotificationLogSchema.index({ createdAt: -1 });

export default models.NotificationLog || model("NotificationLog", NotificationLogSchema);
