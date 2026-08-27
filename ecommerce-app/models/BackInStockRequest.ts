import { Schema, models, model } from "mongoose";

/**
 * BackInStockRequest — "notify me when my size is back".
 *
 * Recorded per variant, not per product: a customer waiting on a Medium does
 * not want an email when the XL is restocked. The stock-adjustment path checks
 * this collection whenever a variant crosses from zero to positive.
 */

const BackInStockRequestSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    variantKey: { type: String, default: "", index: true },
    email: { type: String, default: "", lowercase: true, trim: true },
    phone: { type: String, default: "" },
    user: { type: Schema.Types.ObjectId, ref: "User" },
    notifiedAt: { type: Date },
    status: { type: String, enum: ["waiting", "notified", "cancelled"], default: "waiting", index: true },
  },
  { timestamps: true }
);

BackInStockRequestSchema.index({ product: 1, variantKey: 1, email: 1 }, { unique: true, sparse: true });

export default models.BackInStockRequest || model("BackInStockRequest", BackInStockRequestSchema);
