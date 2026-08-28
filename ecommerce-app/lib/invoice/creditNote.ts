import { connectDB } from "@/lib/db";
import { CreditNote, Invoice, Order, ReturnRequest } from "@/models";
import InvoiceSettings from "@/models/InvoiceSettings";
import { getInvoiceSettings, financialYearOf } from "./settings";
import { amountInWords, stateCodeFor } from "./compute";
import { sendCreditNoteEmail } from "./creditNoteEmail";

/**
 * Credit notes — the GST document issued whenever value flows back to the
 * customer (an approved return, or the cancellation of a paid order).
 *
 * Two rules from the quotation shape this module:
 *   1. Credit notes run on their OWN sequential, financial-year-wise series,
 *      separate from invoices (default prefix "CN").
 *   2. Every credit note must reference the original invoice number and date.
 *
 * Like Invoice, the printed contents are frozen into `snapshot` rather than
 * recomputed later — a credit note is a financial document and must still
 * render as issued even after prices, rates or the company address change.
 */

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Atomically claims the next credit-note number.
 *
 * The counter lives on the InvoiceSettings singleton under `creditNoteNumbering`
 * and is bumped with a single findOneAndUpdate($inc), so two returns approved
 * at the same moment cannot receive the same number — which for a statutory
 * series would be a compliance problem, not just a display bug.
 */
async function claimCreditNoteNumber(issuedAt: Date): Promise<{
  creditNoteNumber: string;
  sequence: number;
  financialYear: string;
}> {
  await connectDB();
  const fy = financialYearOf(issuedAt);

  const doc: any = await InvoiceSettings.findOneAndUpdate(
    { singletonKey: "invoice" },
    { $setOnInsert: { singletonKey: "invoice" } },
    { upsert: true, new: true }
  );

  const cfg = doc.creditNoteNumbering ?? {};
  const prefix = cfg.prefix ?? "CN";
  const padding = cfg.padding ?? 5;
  const includeFy = cfg.includeFinancialYear !== false;
  const resetEachFy = cfg.resetEachFinancialYear !== false;

  // Roll the counter back to 1 when the financial year turns over.
  const storedFy = cfg.sequenceFinancialYear ?? "";
  const needsReset = resetEachFy && storedFy !== fy;

  const updated: any = await InvoiceSettings.findOneAndUpdate(
    { singletonKey: "invoice" },
    needsReset
      ? {
          $set: {
            "creditNoteNumbering.nextSequence": 2,
            "creditNoteNumbering.sequenceFinancialYear": fy,
          },
        }
      : { $inc: { "creditNoteNumbering.nextSequence": 1 } },
    { new: true }
  );

  const sequence = needsReset
    ? 1
    : (updated?.creditNoteNumbering?.nextSequence ?? 2) - 1;

  const parts = [prefix];
  if (includeFy) parts.push(fy);
  parts.push(String(sequence).padStart(padding, "0"));

  return { creditNoteNumber: parts.join("/"), sequence, financialYear: fy };
}

export interface IssueCreditNoteInput {
  orderId: string;
  returnRequestId?: string;
  /** Gross amount being credited back, inclusive of tax where prices include tax. */
  amount: number;
  reason: string;
}

/**
 * Issues a credit note against an order.
 *
 * Tax is derived from the ORIGINAL invoice's effective rate rather than from
 * current settings, so a rate change between the sale and the return cannot
 * make the credit note disagree with the invoice it reverses. CGST/SGST vs IGST
 * follows the original invoice's place of supply for the same reason.
 *
 * Returns `null` when the order has no invoice — there is nothing to reverse.
 */
export async function issueCreditNote(input: IssueCreditNoteInput) {
  await connectDB();

  if (input.amount <= 0) return null;

  // One credit note per return request; re-running is a no-op.
  if (input.returnRequestId) {
    const existing = await CreditNote.findOne({ returnRequest: input.returnRequestId });
    if (existing) return existing;
  }

  const [order, invoice, settings] = await Promise.all([
    Order.findById(input.orderId).lean<any>(),
    Invoice.findOne({ order: input.orderId }).lean<any>(),
    getInvoiceSettings(),
  ]);

  if (!order) return null;
  if (!invoice) {
    // No tax invoice was ever issued (e.g. an unpaid order that was cancelled),
    // so there is nothing to raise a credit note against.
    return null;
  }

  const issuedAt = new Date();
  const { creditNoteNumber, sequence, financialYear } = await claimCreditNoteNumber(issuedAt);

  const snap = invoice.snapshot ?? {};
  const isInterState = Boolean(invoice.isInterState);
  const pricesIncludeTax = snap.taxConfig?.pricesIncludeTax !== false;
  const gstEnabled = snap.taxConfig?.gstEnabled !== false;

  // Effective blended rate on the original invoice, so a mixed-rate order
  // credits back proportionally rather than at a single assumed slab.
  const originalTaxable = snap.totals?.taxableValue ?? 0;
  const originalTax = snap.totals?.totalTax ?? 0;
  const effectiveRate =
    gstEnabled && originalTaxable > 0 ? (originalTax / originalTaxable) * 100 : 0;

  const gross = round2(input.amount);
  const taxableValue = gstEnabled
    ? pricesIncludeTax
      ? round2(gross / (1 + effectiveRate / 100))
      : gross
    : gross;
  const totalTax = gstEnabled ? round2(gross - taxableValue) : 0;

  const cgst = isInterState ? 0 : round2(totalTax / 2);
  const sgst = isInterState ? 0 : round2(totalTax - cgst);
  const igst = isInterState ? totalTax : 0;

  const buyerState = order.shippingAddress?.state ?? "";

  const snapshot = {
    creditNoteNumber,
    issuedAt: issuedAt.toISOString(),
    financialYear,

    seller: settings.seller,
    document: {
      title: "CREDIT NOTE",
      declaration:
        "This credit note is issued against the tax invoice referenced above, in respect of goods returned.",
      footerText: settings.document?.footerText ?? "",
    },

    buyer: snap.buyer ?? {
      name: order.shippingAddress?.fullName ?? "",
      email: order.guestEmail ?? "",
      phone: order.shippingAddress?.phone ?? "",
      addressLines: [order.shippingAddress?.line1, order.shippingAddress?.line2].filter(Boolean),
      city: order.shippingAddress?.city ?? "",
      state: buyerState,
      stateCode: stateCodeFor(buyerState),
      pincode: order.shippingAddress?.pincode ?? "",
    },

    reference: {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.issuedAt,
      orderNumber: order.orderNumber,
      reason: input.reason,
    },

    placeOfSupply: invoice.placeOfSupply,
    isInterState,

    totals: {
      taxableValue,
      gstRate: round2(effectiveRate),
      cgst,
      sgst,
      igst,
      totalTax,
      grandTotal: gross,
    },

    amountInWords: amountInWords(gross),
  };

  const note = await CreditNote.create({
    creditNoteNumber,
    financialYear,
    sequence,
    issuedAt,
    order: order._id,
    user: order.user,
    returnRequest: input.returnRequestId,
    invoice: invoice._id,
    originalInvoiceNumber: invoice.invoiceNumber,
    originalInvoiceDate: invoice.issuedAt,
    reason: input.reason,
    grandTotal: gross,
    totalTax,
    buyerName: invoice.buyerName,
    placeOfSupply: invoice.placeOfSupply,
    isInterState,
    snapshot,
  });

  if (input.returnRequestId) {
    await ReturnRequest.findByIdAndUpdate(input.returnRequestId, { creditNote: note._id });
  }

  const recipient = snapshot.buyer?.email || order.guestEmail || "";
  if (recipient) await sendCreditNoteEmail(note.toObject(), recipient);

  return note;
}
