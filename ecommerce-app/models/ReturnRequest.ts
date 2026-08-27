import { Schema, models, model } from "mongoose";

/**
 * ReturnRequest — the full return / exchange workflow from the quotation:
 *
 *   customer request → admin approval → reverse pickup → warehouse QC
 *     → disposition (restock / quarantine / write-off)
 *     → resolution (refund to source, store credit, or replacement order)
 *
 * One document carries the whole lifecycle rather than splitting it across
 * collections, because every stage is a state transition on the same business
 * object and the admin queue needs all of it on one row.
 *
 * Line items are a subset of the order's items — a customer may return one
 * shirt out of a three-item order.
 */

export const RETURN_STATUSES = [
  "requested",
  "approved",
  "rejected",
  "pickup_scheduled",
  "picked_up",
  "received",
  "qc_passed",
  "qc_failed",
  "refund_initiated",
  "refund_processed",
  "completed",
  "cancelled",
] as const;

export const RETURN_REASONS = [
  "size_fit_issue",
  "damaged_or_defective",
  "wrong_item_received",
  "not_as_described",
  "quality_not_expected",
  "changed_mind",
  "other",
] as const;

const ReturnItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    title: { type: String, default: "" },
    image: { type: String, default: "" },
    /** Frozen copy of the ordered variant, e.g. { Size: "M" }. */
    variant: { type: Map, of: String },
    variantKey: { type: String, default: "" },
    quantity: { type: Number, required: true, min: 1 },
    /** Unit price actually charged — refunds are computed from this, never from the live price. */
    unitPrice: { type: Number, required: true },
    /** For exchanges: the variant the customer wants instead. */
    exchangeVariant: { type: Map, of: String },
    exchangeVariantKey: { type: String, default: "" },
    /** Set at QC time, per line. */
    qcResult: { type: String, enum: ["pending", "passed", "failed"], default: "pending" },
    qcRemarks: { type: String, default: "" },
    qcImages: [{ type: String }],
    disposition: {
      type: String,
      enum: ["pending", "sellable", "quarantined", "written_off"],
      default: "pending",
    },
  },
  { _id: false }
);

const TimelineSchema = new Schema(
  {
    status: { type: String, required: true },
    note: { type: String, default: "" },
    at: { type: Date, default: Date.now },
    by: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { _id: false }
);

const ReturnRequestSchema = new Schema(
  {
    /** Customer-facing reference, e.g. RET/2026-27/00013. */
    rmaNumber: { type: String, unique: true, index: true },
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    type: { type: String, enum: ["return", "exchange"], default: "return" },
    status: { type: String, enum: RETURN_STATUSES, default: "requested", index: true },

    items: { type: [ReturnItemSchema], default: [] },

    reason: { type: String, enum: RETURN_REASONS, default: "other" },
    /** Free-text detail from the customer. */
    comments: { type: String, default: "" },
    /** Customer-uploaded proof images (Cloudinary URLs). */
    images: [{ type: String }],

    /** Recorded whenever an admin rejects, so the customer sees why. */
    rejectionReason: { type: String, default: "" },
    /** Not shown to the customer. */
    adminNotes: { type: String, default: "" },

    /** Reverse pickup, coordinated through the courier API. */
    reversePickup: {
      courier: { type: String, default: "" },
      awb: { type: String, default: "" },
      trackingUrl: { type: String, default: "" },
      scheduledFor: { type: Date },
      pickedUpAt: { type: Date },
    },

    /** How the customer gets their money back. */
    resolution: {
      type: String,
      enum: ["pending", "refund_source", "store_credit", "replacement", "rejected"],
      default: "pending",
    },
    refundAmount: { type: Number, default: 0 },
    refundStatus: {
      type: String,
      enum: ["not_applicable", "initiated", "processed", "completed", "failed"],
      default: "not_applicable",
    },
    refundReference: { type: String, default: "" },
    refundedAt: { type: Date },

    /** Set when the resolution is an exchange — links to the new forward order. */
    replacementOrder: { type: Schema.Types.ObjectId, ref: "Order" },
    /** Credit note issued against this return (separate invoice series). */
    creditNote: { type: Schema.Types.ObjectId, ref: "CreditNote" },

    /** HisabKitab sale-return reconciliation metadata. */
    erpReturnTransactionId: { type: String, default: "", index: true, sparse: true },
    erpReturnStatus: { type: String, default: "" },
    erpSyncedAt: { type: Date },
    erpSyncError: { type: String, default: "" },

    timeline: { type: [TimelineSchema], default: [] },
  },
  { timestamps: true }
);

ReturnRequestSchema.index({ createdAt: -1 });

export default models.ReturnRequest || model("ReturnRequest", ReturnRequestSchema);
