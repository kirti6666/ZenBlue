import { Schema, models, model } from "mongoose";

/**
 * ContactMessage — submissions from the Contact Us form, the bulk/corporate
 * order enquiry form, and the customisation enquiry form.
 *
 * One collection rather than two, because the admin works a single queue and
 * both are "someone wants a reply". `type` separates them; the bulk-only
 * fields below are simply absent on a contact-form message.
 *
 * Persisted rather than only emailed, so a message is never lost to an SMTP
 * outage or a spam filter, and so the admin has one queue to work through with
 * a resolved/unresolved state.
 */

const ContactMessageSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: "" },
    subject: { type: String, default: "" },
    message: { type: String, required: true },
    /** Set when the sender was logged in. */
    user: { type: Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: ["new", "in_progress", "resolved"], default: "new", index: true },
    type: { type: String, enum: ["contact", "bulk", "custom"], default: "contact", index: true },

    // --- Bulk / corporate enquiry only ---
    company: { type: String, default: "" },
    /** Free text, not a number: "200-250" and "approx 500" are both real answers. */
    quantity: { type: String, default: "" },
    budget: { type: String, default: "" },
    /** When they need delivery by, as typed. */
    needByDate: { type: String, default: "" },
    /** Which products/categories the enquiry is about. */
    productInterest: { type: String, default: "" },
    /** Branding/customisation asked for, e.g. embroidered logo. */
    customisation: { type: String, default: "" },
    adminNotes: { type: String, default: "" },
  },
  { timestamps: true }
);

ContactMessageSchema.index({ createdAt: -1 });

export default models.ContactMessage || model("ContactMessage", ContactMessageSchema);
