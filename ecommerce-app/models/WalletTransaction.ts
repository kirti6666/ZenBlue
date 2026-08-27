import { Schema, models, model } from "mongoose";

/**
 * WalletTransaction — the store-credit ledger.
 *
 * Design decision: there is no `balance` field anywhere. A customer's balance
 * is the sum of their ledger rows, and every row records `balanceAfter` at the
 * time it was written. A stored balance can drift out of sync with its history
 * after a partial failure; a ledger cannot. `getWalletBalance()` in
 * lib/wallet.ts is the only sanctioned way to read a balance.
 *
 * Credits are positive, redemptions and expiries are negative.
 */

export const WALLET_REASONS = [
  "return_refund",
  "order_cancellation",
  "goodwill",
  "promotion",
  "manual_adjustment",
  "order_redemption",
  "redemption_reversal",
  "expiry",
] as const;

const WalletTransactionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    /** Signed: positive = credit issued, negative = credit spent or expired. */
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    reason: { type: String, enum: WALLET_REASONS, default: "manual_adjustment" },
    note: { type: String, default: "" },
    order: { type: Schema.Types.ObjectId, ref: "Order" },
    returnRequest: { type: Schema.Types.ObjectId, ref: "ReturnRequest" },
    /** Null means the credit never expires. */
    expiresAt: { type: Date },
    performedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

WalletTransactionSchema.index({ user: 1, createdAt: -1 });

export default models.WalletTransaction || model("WalletTransaction", WalletTransactionSchema);
