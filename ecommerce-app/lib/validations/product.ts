import { z } from "zod";

const variantAttributeSchema = z.object({
  name: z.string().min(1),
  options: z.array(z.string().min(1)).min(1),
});

const variantCombinationSchema = z.object({
  combination: z.record(z.string()),
  sku: z.string().optional(),
  stock: z.number().min(0),
  price: z.number().positive().optional(),
  image: z.string().optional(),
});

const productSizeChartSchema = z
  .object({
    title: z.string().trim().min(1, "Size chart title is required"),
    unitNote: z.string().trim().optional(),
    columns: z.array(z.string().trim().min(1)).min(2, "Add at least two chart columns"),
    rows: z.array(z.array(z.string().trim())).min(1, "Add at least one size row"),
  })
  .superRefine((chart, ctx) => {
    chart.rows.forEach((row, index) => {
      if (row.length !== chart.columns.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Size chart row ${index + 1} must have ${chart.columns.length} cells`,
          path: ["rows", index],
        });
      }
    });
  });

export const productSchema = z.object({
  title: z.string().trim().min(2, "Title is required"),
  description: z.string().trim().min(10, "Description must be at least 10 characters"),
  category: z.string().min(1, "Category is required"),
  price: z.number().positive("Price must be greater than 0"),
  discountPrice: z.number().positive().optional(),
  sku: z.string().optional(),
  images: z.array(z.string()).min(1, "At least one image is required"),
  media: z
    .array(
      z.object({
        type: z.enum(["image", "video"]).default("image"),
        url: z.string().min(1),
        poster: z.string().optional(),
        alt: z.string().optional(),
      })
    )
    .optional(),
  tags: z.array(z.string()).default([]),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
  variants: z.array(variantAttributeSchema).default([]),
  variantCombinations: z.array(variantCombinationSchema).default([]),
  stock: z.number().min(0).default(0),

  // --- Extended catalogue fields (ZenBlue) ---
  hsnCode: z.string().optional(),
  // Null means "fall back to the default rate in Invoice Settings", so a slab
  // change does not require editing every product.
  gstRate: z.number().min(0).max(28).nullable().optional(),
  fabric: z.string().optional(),
  careInstructions: z.string().optional(),
  fitType: z.string().optional(),
  videoUrl: z.string().optional(),
  sizeChartKey: z.string().optional(),
  sizeChart: productSizeChartSchema.nullable().optional(),
  weightKg: z.number().min(0).optional(),
  packageLengthCm: z.number().min(0).optional(),
  packageBreadthCm: z.number().min(0).optional(),
  packageHeightCm: z.number().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  backInStockEnabled: z.boolean().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  publishedAt: z.coerce.date().optional(),
});

export type ProductInput = z.infer<typeof productSchema>;
