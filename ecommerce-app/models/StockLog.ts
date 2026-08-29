import { Schema, models, model } from "mongoose";

/**
 * StockLog — an append-only ledger of every stock movement.
 *
 * Nothing ever edits or deletes a row here. Current stock lives on the Product
 * (fast reads); this collection answers "how did it get to that number?" —
 * which the quotation requires as the "stock adjustment log", and which is the
 * only way to reconcile a physical count against the system.
 *
 * `delta` is signed: negative for a sale or a write-off, positive for a
 * restock or a returned-to-sellable item.
 */

export const STOCK_REASONS = [
  "manual_adjustment",
  "order_placed",
  "order_cancelled",
  "return_restock",
  "return_written_off",
  "exchange_reserved",
  "exchange_released",
  "csv_import",
  "erp_sync",
  "initial_stock",
] as const;

const StockLogSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    /** Human-readable variant key, e.g. "Size:M / Colour:Navy". Empty for simple products. */
    variantKey: { type: String, default: "" },
    sku: { type: String, default: "" },
    delta: { type: Number, required: true },
    /** Stock level after this movement was applied — makes the ledger self-checking. */
    resultingStock: { type: Number, default: 0 },
    reason: { type: String, enum: STOCK_REASONS, default: "manual_adjustment" },
    note: { type: String, default: "" },
    /** Set for movements caused by an order/return rather than a person. */
    order: { type: Schema.Types.ObjectId, ref: "Order" },
    returnRequest: { type: Schema.Types.ObjectId, ref: "ReturnRequest" },
    performedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

StockLogSchema.index({ createdAt: -1 });

export default models.StockLog || model("StockLog", StockLogSchema);
