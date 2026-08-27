import { Schema, models, model } from "mongoose";

/**
 * ContentPage — admin-editable static pages (About, Shipping Policy, Returns &
 * Exchange, Privacy, Terms, and any extra page the client wants later).
 *
 * Design decision: one generic collection keyed by `slug` rather than a fixed
 * field per page on SiteSettings. The quotation names four policy pages plus
 * About, but clients invariably ask for a fifth ("Size Guide", "Store Locator")
 * — with this shape that is a row, not a schema migration and a redeploy.
 *
 * `isSystem` marks the pages the footer links to by slug. They can be edited
 * and unpublished, but not deleted, so those links can never 404.
 */

const ContentPageSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    title: { type: String, required: true, trim: true },
    /** Short line under the page title. */
    subtitle: { type: String, default: "" },
    /** Markdown-ish body; rendered by components/storefront/RichText.tsx. */
    body: { type: String, default: "" },
    metaTitle: { type: String, default: "" },
    metaDescription: { type: String, default: "" },
    isPublished: { type: Boolean, default: true },
    isSystem: { type: Boolean, default: false },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default models.ContentPage || model("ContentPage", ContentPageSchema);
