import { Schema, models, model } from "mongoose";

/**
 * AbandonedCart — a snapshot of a cart that was never checked out, plus the
 * state of the recovery sequence running against it.
 *
 * Works for guests as well as logged-in customers: the storefront assigns an
 * anonymous `cartToken` (localStorage) on first add-to-cart, and an email or
 * phone captured anywhere (newsletter, checkout step 1, OTP) upgrades that row
 * into a contactable one.
 *
 * `recoveryToken` backs the single-use tokenised restore link. It is cleared
 * the moment it is consumed, so a forwarded link cannot repopulate someone
 * else's cart.
 */

const AbandonedItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product" },
    title: { type: String, default: "" },
    slug: { type: String, default: "" },
    image: { type: String, default: "" },
    variantKey: { type: String, default: "" },
    variant: { type: Map, of: String },
    quantity: { type: Number, default: 1 },
    price: { type: Number, default: 0 },
  },
  { _id: false }
);

const SequenceStepSchema = new Schema(
  {
    step: { type: Number, required: true },
    channel: { type: String, enum: ["email", "whatsapp", "sms"], required: true },
    sentAt: { type: Date, default: Date.now },
    couponCode: { type: String, default: "" },
  },
  { _id: false }
);

const AbandonedCartSchema = new Schema(
  {
    /** Stable per-browser id; the join key for guest carts. */
    cartToken: { type: String, required: true, unique: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", index: true },
    email: { type: String, default: "", index: true },
    phone: { type: String, default: "" },
    name: { type: String, default: "" },

    items: { type: [AbandonedItemSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    itemCount: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["active", "abandoned", "recovered", "converted", "expired"],
      default: "active",
      index: true,
    },
    lastActivityAt: { type: Date, default: Date.now, index: true },

    /** Recovery sequence state. */
    stepsSent: { type: [SequenceStepSchema], default: [] },
    nextStepAt: { type: Date, index: true },
    /** Single-use restore link token; cleared on use. */
    recoveryToken: { type: String, index: true },
    recoveryTokenExpiresAt: { type: Date },
    recoveredAt: { type: Date },
    /** Set when the cart converts — attributes revenue back to the step that won it. */
    recoveredOrder: { type: Schema.Types.ObjectId, ref: "Order" },
    recoveredByStep: { type: Number, default: 0 },
    recoveredRevenue: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default models.AbandonedCart || model("AbandonedCart", AbandonedCartSchema);
