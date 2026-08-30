import mongoose, { Schema, models, model } from "mongoose";

export interface IVariantAttribute {
  name: string; // e.g. "Size"
  options: string[]; // e.g. ["S", "M", "L"]
}

export interface IVariantCombination {
  combination: Map<string, string>; // e.g. { Size: "M", Color: "Red" }
  sku?: string;
  stock: number;
  price?: number; // overrides base price if set
  image?: string;
}

export interface IProductSizeChart {
  title: string;
  unitNote?: string;
  columns: string[];
  rows: string[][];
}

export interface IProduct {
  _id: string;
  title: string;
  slug: string;
  description: string;
  images: string[];
  category: mongoose.Types.ObjectId;
  price: number;
  discountPrice?: number;
  sku?: string;
  stock: number; // used only when there are no variants
  variants: IVariantAttribute[];
  variantCombinations: IVariantCombination[];
  tags: string[];

  // --- Extended catalogue fields (ZenBlue) ---
  /** HSN code drives the GST rate applied on the invoice for this product. */
  hsnCode?: string;
  gstRate?: number;
  fabric?: string;
  careInstructions?: string;
  fitType?: string;
  /** Hosted video URL shown alongside the image gallery. Legacy — prefer `media`. */
  videoUrl?: string;
  /** Ordered gallery of images and videos. Supersedes `images` + `videoUrl`. */
  media?: { type: "image" | "video"; url: string; poster?: string; alt?: string }[];
  /** Slug of the size chart to show on the PDP (see SiteSettings.sizeCharts). */
  sizeChartKey?: string;
  /** Product-specific chart. When present it overrides the shared chart key. */
  sizeChart?: IProductSizeChart | null;
  /** Dead weight in kg — courier rate calculation uses max(dead, volumetric). */
  weightKg?: number;
  packageLengthCm?: number;
  packageBreadthCm?: number;
  packageHeightCm?: number;
  /** Below this level the admin dashboard raises a low-stock alert. */
  lowStockThreshold?: number;
  /** Show a "Notify me" capture when a variant is out of stock. */
  backInStockEnabled?: boolean;
  metaTitle?: string;
  metaDescription?: string;
  /** Set on create/import; powers the New Arrivals listing. */
  publishedAt?: Date;
  /** Denormalized sales counter — sorts the Best Sellers rail without an aggregation. */
  salesCount?: number;

  ratingsAverage: number;
  ratingsCount: number;
  isFeatured: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const VariantAttributeSchema = new Schema<IVariantAttribute>(
  {
    name: { type: String, required: true },
    options: [{ type: String, required: true }],
  },
  { _id: false }
);

const VariantCombinationSchema = new Schema<IVariantCombination>(
  {
    combination: { type: Map, of: String, required: true },
    sku: { type: String },
    stock: { type: Number, required: true, default: 0 },
    price: { type: Number },
    image: { type: String },
  },
  { _id: false }
);

const ProductSizeChartSchema = new Schema<IProductSizeChart>(
  {
    title: { type: String, required: true, trim: true },
    unitNote: { type: String, default: "" },
    columns: [{ type: String, required: true }],
    rows: [[{ type: String, required: true }]],
  },
  { _id: false }
);

const ProductSchema = new Schema<IProduct>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, required: true },
    images: [{ type: String }],
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    price: { type: Number, required: true },
    discountPrice: { type: Number },
    sku: { type: String },
    stock: { type: Number, default: 0 },
    variants: [VariantAttributeSchema],
    variantCombinations: [VariantCombinationSchema],
    tags: [{ type: String }],

    // --- Extended catalogue fields (ZenBlue) ---
    hsnCode: { type: String, default: "" },
    // Null means "use the default rate from Invoice Settings" — only set this
    // when a garment genuinely sits in a different slab (e.g. apparel over the
    // price threshold), so a rate change doesn't need a catalogue-wide edit.
    gstRate: { type: Number, default: null },
    fabric: { type: String, default: "" },
    careInstructions: { type: String, default: "" },
    fitType: { type: String, default: "" },
    videoUrl: { type: String, default: "" },
    // Ordered gallery. `images` is retained so existing products and anything
    // reading images[0] keeps working; normalizeMedia() in lib/media.ts reads
    // whichever is populated.
    media: {
      type: [
        new Schema(
          {
            type: { type: String, enum: ["image", "video"], default: "image" },
            url: { type: String, required: true },
            poster: { type: String, default: "" },
            alt: { type: String, default: "" },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    sizeChartKey: { type: String, default: "" },
    sizeChart: { type: ProductSizeChartSchema, default: undefined },
    weightKg: { type: Number, default: 0.3 },
    packageLengthCm: { type: Number, default: 0 },
    packageBreadthCm: { type: Number, default: 0 },
    packageHeightCm: { type: Number, default: 0 },
    lowStockThreshold: { type: Number, default: 5 },
    backInStockEnabled: { type: Boolean, default: true },
    metaTitle: { type: String, default: "" },
    metaDescription: { type: String, default: "" },
    publishedAt: { type: Date, default: Date.now },
    salesCount: { type: Number, default: 0 },

    ratingsAverage: { type: Number, default: 0 },
    ratingsCount: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ProductSchema.index({ category: 1 });
ProductSchema.index({ title: "text", description: "text", tags: "text" });
// New Arrivals sorts on this; Best Sellers on salesCount.
ProductSchema.index({ publishedAt: -1 });
ProductSchema.index({ salesCount: -1 });

export default models.Product || model<IProduct>("Product", ProductSchema);
