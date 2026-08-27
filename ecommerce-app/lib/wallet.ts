import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { WalletTransaction } from "@/models";

/**
 * Store-credit wallet.
 *
 * There is no stored balance anywhere — the balance is derived from the ledger
 * (see models/WalletTransaction.ts for why). Every read goes through
 * `getWalletBalance`, and every write goes through `creditWallet` /
 * `debitWallet`, so the `balanceAfter` column can never disagree with the sum
 * of the rows above it.
 */

export async function getWalletBalance(userId: string): Promise<number> {
  await connectDB();
  const [agg] = await WalletTransaction.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId) } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  // Guard against float drift from repeated partial refunds.
  return Math.round(((agg?.total ?? 0) + Number.EPSILON) * 100) / 100;
}

interface LedgerEntry {
  userId: string;
  amount: number; // always positive; direction is set by the caller
  reason: string;
  note?: string;
  orderId?: string;
  returnRequestId?: string;
  performedBy?: string;
  expiresAt?: Date;
}

async function writeEntry(entry: LedgerEntry, signedAmount: number) {
  await connectDB();
  const balanceAfter =
    Math.round(((await getWalletBalance(entry.userId)) + signedAmount + Number.EPSILON) * 100) / 100;

  const [doc] = await WalletTransaction.create([
    {
      user: entry.userId,
      amount: signedAmount,
      balanceAfter,
      reason: entry.reason,
      note: entry.note ?? "",
      order: entry.orderId,
      returnRequest: entry.returnRequestId,
      performedBy: entry.performedBy,
      expiresAt: entry.expiresAt,
    },
  ]);
  return { transaction: doc, balance: balanceAfter };
}

/** Add credit to a customer's wallet (refund, goodwill, promotion). */
export async function creditWallet(entry: LedgerEntry) {
  if (entry.amount <= 0) throw new Error("Credit amount must be positive");
  return writeEntry(entry, Math.abs(entry.amount));
}

/**
 * Spend credit. Refuses to overdraw rather than clamping, so a checkout bug
 * can never hand out free product — the caller is expected to have already
 * capped the redemption at the available balance.
 */
export async function debitWallet(entry: LedgerEntry) {
  if (entry.amount <= 0) throw new Error("Debit amount must be positive");
  const balance = await getWalletBalance(entry.userId);
  if (entry.amount > balance) {
    throw new Error(`Insufficient store credit: balance ${balance}, requested ${entry.amount}`);
  }
  return writeEntry(entry, -Math.abs(entry.amount));
}

/** Full ledger for the customer's My Account page and the admin wallet view. */
export async function getWalletLedger(userId: string, limit = 100) {
  await connectDB();
  return WalletTransaction.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("order", "orderNumber")
    .lean();
}

/**
 * How much credit may be applied to a cart of this value. Credit never covers
 * the entire order when paying online: leaving at least ₹1 payable keeps the
 * Razorpay flow valid (a zero-rupee payment order is rejected by the gateway).
 */
export function maxRedeemable(balance: number, orderTotal: number, method: "cod" | "razorpay"): number {
  if (balance <= 0 || orderTotal <= 0) return 0;
  const cap = method === "razorpay" ? Math.max(0, orderTotal - 1) : orderTotal;
  return Math.min(balance, cap);
}
