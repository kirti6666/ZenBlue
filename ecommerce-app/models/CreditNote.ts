import { Schema, models, model } from "mongoose";

/**
 * CreditNote — the GST document issued when value flows back to the customer
 * (an approved return, or a cancellation of a paid order).
 *
 * It mirrors Invoice deliberately: its own sequential, financial-year-wise
 * series (prefix CN by default), and a frozen `snapshot` of everything printed.
 * Under GST a credit note must reference the original invoice number and date,
 * which is why `originalInvoiceNumber` is denormalized onto the row.
 */

const CreditNoteSchema = new Schema(
  {
    creditNoteNumber: { type: String, required: true, unique: true, index: true },
    financialYear: { type: String, default: "" },
    sequence: { type: Number, default: 0 },
    issuedAt: { type: Date, default: Date.now },

    order: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", index: true },
    returnRequest: { type: Schema.Types.ObjectId, ref: "ReturnRequest", index: true },

    /** GST requires the original invoice to be referenced on the credit note. */
    invoice: { type: Schema.Types.ObjectId, ref: "Invoice" },
    originalInvoiceNumber: { type: String, default: "" },
    originalInvoiceDate: { type: Date },

    reason: { type: String, default: "" },

    /** Denormalized for admin listing without loading the snapshot. */
    grandTotal: { type: Number, default: 0 },
    totalTax: { type: Number, default: 0 },
    buyerName: { type: String, default: "" },
    placeOfSupply: { type: String, default: "" },
    isInterState: { type: Boolean, default: false },

    snapshot: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

CreditNoteSchema.index({ createdAt: -1 });

export default models.CreditNote || model("CreditNote", CreditNoteSchema);
