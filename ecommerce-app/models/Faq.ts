import { Schema, models, model } from "mongoose";

/**
 * Faq — one question/answer pair, grouped by `category` (Orders, Shipping,
 * Returns, Products, Payments…) and ordered by `sortOrder` within the group.
 *
 * Kept as its own collection rather than an array on ContentPage so the FAQ
 * page can render grouped accordions, individual entries can be reordered from
 * the admin without rewriting a whole page body, and the same entries can feed
 * FAQPage JSON-LD for search results.
 */

const FaqSchema = new Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true },
    category: { type: String, default: "General", trim: true },
    sortOrder: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

FaqSchema.index({ category: 1, sortOrder: 1 });

export default models.Faq || model("Faq", FaqSchema);
