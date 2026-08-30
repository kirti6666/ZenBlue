"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUploader } from "./ImageUploader";
import { MediaUploader } from "./MediaUploader";
import { normalizeMedia, primaryImage, type MediaItem } from "@/lib/media";
import { VariantBuilder, VariantAttribute, VariantCombination } from "./VariantBuilder";

interface Category {
  _id: string;
  name: string;
}

interface InitialProductData {
  title?: string;
  description?: string;
  category?: string | { _id: string };
  price?: number;
  discountPrice?: number;
  sku?: string;
  stock?: number;
  tags?: string[];
  images?: string[];
  isFeatured?: boolean;
  isActive?: boolean;
  variants?: VariantAttribute[];
  variantCombinations?: VariantCombination[];
  hsnCode?: string;
  gstRate?: number | null;
  fabric?: string;
  careInstructions?: string;
  fitType?: string;
  videoUrl?: string;
  media?: MediaItem[];
  sizeChartKey?: string;
  sizeChart?: {
    title: string;
    unitNote?: string;
    columns: string[];
    rows: string[][];
  } | null;
  weightKg?: number;
  packageLengthCm?: number;
  packageBreadthCm?: number;
  packageHeightCm?: number;
  lowStockThreshold?: number;
  backInStockEnabled?: boolean;
  metaTitle?: string;
  metaDescription?: string;
}

/** Size charts available to point a product at, from Site Settings. */
export interface SizeChartOption {
  key: string;
  title: string;
}

interface ProductFormProps {
  categories: Category[];
  initialData?: InitialProductData;
  productId?: string;
  sizeCharts?: SizeChartOption[];
}

export function ProductForm({
  categories,
  initialData,
  productId,
  sizeCharts = [],
}: ProductFormProps) {
  const router = useRouter();
  const isEdit = Boolean(productId);

  const initialCategoryId =
    typeof initialData?.category === "object"
      ? initialData.category._id
      : initialData?.category ?? "";

  const [title, setTitle] = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [category, setCategory] = useState(initialCategoryId);
  const [price, setPrice] = useState(initialData?.price?.toString() ?? "");
  const [discountPrice, setDiscountPrice] = useState(
    initialData?.discountPrice?.toString() ?? ""
  );
  const [sku, setSku] = useState(initialData?.sku ?? "");
  const [stock, setStock] = useState(initialData?.stock ?? 0);
  const [tags, setTags] = useState((initialData?.tags ?? []).join(", "));
  // One gallery holding images and videos. `images` is still derived from it on
  // save so anything reading images[0] (cards, emails, OG tags) keeps working.
  const [media, setMedia] = useState<MediaItem[]>(() => normalizeMedia(initialData ?? {}));
  const [isFeatured, setIsFeatured] = useState(initialData?.isFeatured ?? false);
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);

  const [hasVariants, setHasVariants] = useState((initialData?.variants?.length ?? 0) > 0);
  const [variants, setVariants] = useState<VariantAttribute[]>(initialData?.variants ?? []);
  const [combinations, setCombinations] = useState<VariantCombination[]>(
    initialData?.variantCombinations ?? []
  );

  // --- Extended catalogue fields ---
  const [hsnCode, setHsnCode] = useState(initialData?.hsnCode ?? "");
  const [gstRate, setGstRate] = useState(
    initialData?.gstRate != null ? String(initialData.gstRate) : ""
  );
  const [fabric, setFabric] = useState(initialData?.fabric ?? "");
  const [careInstructions, setCareInstructions] = useState(initialData?.careInstructions ?? "");
  const [fitType, setFitType] = useState(initialData?.fitType ?? "");
  const [videoUrl, setVideoUrl] = useState(initialData?.videoUrl ?? "");
  const [sizeChartKey, setSizeChartKey] = useState(initialData?.sizeChartKey ?? "");
  const [customChartEnabled, setCustomChartEnabled] = useState(Boolean(initialData?.sizeChart));
  const [sizeChartTitle, setSizeChartTitle] = useState(
    initialData?.sizeChart?.title ?? `${initialData?.title ?? "Product"} Size Guide`
  );
  const [sizeChartUnitNote, setSizeChartUnitNote] = useState(
    initialData?.sizeChart?.unitNote ?? "All measurements in inches. Garment measured flat."
  );
  const [sizeChartColumns, setSizeChartColumns] = useState(
    (initialData?.sizeChart?.columns ?? ["Size", "Chest", "Length"]).join(", ")
  );
  const [sizeChartRows, setSizeChartRows] = useState(
    (initialData?.sizeChart?.rows ?? []).map((row) => row.join(", ")).join("\n")
  );
  const [weightKg, setWeightKg] = useState(String(initialData?.weightKg ?? 0.3));
  const [lengthCm, setLengthCm] = useState(String(initialData?.packageLengthCm ?? 0));
  const [breadthCm, setBreadthCm] = useState(String(initialData?.packageBreadthCm ?? 0));
  const [heightCm, setHeightCm] = useState(String(initialData?.packageHeightCm ?? 0));
  const [lowStockThreshold, setLowStockThreshold] = useState(
    String(initialData?.lowStockThreshold ?? 5)
  );
  const [backInStockEnabled, setBackInStockEnabled] = useState(
    initialData?.backInStockEnabled ?? true
  );
  const [metaTitle, setMetaTitle] = useState(initialData?.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(initialData?.metaDescription ?? "");

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!category) {
      setError("Please select a category");
      return;
    }
    if (!media.some((m) => m.type === "image")) {
      setError("Add at least one image — a video alone cannot be used as the thumbnail");
      return;
    }
    if (hasVariants && combinations.length === 0) {
      setError("Add at least one variant attribute, or turn off variants");
      return;
    }

    const chartColumns = sizeChartColumns
      .split(",")
      .map((cell) => cell.trim())
      .filter(Boolean);
    const chartRows = sizeChartRows
      .split("\n")
      .map((line) => line.split(",").map((cell) => cell.trim()))
      .filter((row) => row.some(Boolean));
    if (
      customChartEnabled &&
      (!sizeChartTitle.trim() ||
        chartColumns.length < 2 ||
        chartRows.length === 0 ||
        chartRows.some((row) => row.length !== chartColumns.length))
    ) {
      setError(
        "Complete the size chart and ensure every row has the same number of cells as the columns."
      );
      return;
    }

    setSaving(true);

    const payload = {
      title,
      description,
      category,
      price: Number(price),
      discountPrice: discountPrice ? Number(discountPrice) : undefined,
      sku: sku || undefined,
      media,
      images: media.filter((m) => m.type === "image").map((m) => m.url),
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      isFeatured,
      isActive,
      variants: hasVariants ? variants : [],
      variantCombinations: hasVariants ? combinations : [],
      stock: hasVariants ? 0 : Number(stock),

      hsnCode: hsnCode || undefined,
      // Empty means "inherit the default GST rate", which is a null on the
      // model — not zero, which would mean genuinely tax-exempt.
      gstRate: gstRate === "" ? null : Number(gstRate),
      fabric: fabric || undefined,
      careInstructions: careInstructions || undefined,
      fitType: fitType || undefined,
      videoUrl: videoUrl || undefined,
      sizeChartKey: sizeChartKey || undefined,
      sizeChart: customChartEnabled
        ? {
            title: sizeChartTitle.trim(),
            unitNote: sizeChartUnitNote.trim() || undefined,
            columns: chartColumns,
            rows: chartRows,
          }
        : null,
      weightKg: Number(weightKg) || undefined,
      packageLengthCm: Number(lengthCm) || undefined,
      packageBreadthCm: Number(breadthCm) || undefined,
      packageHeightCm: Number(heightCm) || undefined,
      lowStockThreshold: Number(lowStockThreshold),
      backInStockEnabled,
      metaTitle: metaTitle || undefined,
      metaDescription: metaDescription || undefined,
    };

    try {
      const res = await fetch(isEdit ? `/api/products/${productId}` : "/api/products", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to save product");
        return;
      }

      router.push("/admin/products");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      <div>
        <label className="block text-sm font-medium mb-1">Title</label>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-md border px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          required
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-md border px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Category</label>
        <select
          required
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-md border px-3 py-2"
        >
          <option value="">Select a category</option>
          {categories.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Price (₹)</label>
          <input
            required
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Discount Price (₹)</label>
          <input
            type="number"
            min={0}
            value={discountPrice}
            onChange={(e) => setDiscountPrice(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">SKU</label>
          <input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Tags (comma separated)</label>
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="w-full rounded-md border px-3 py-2"
        />
      </div>

      <MediaUploader
        media={media}
        onChange={setMedia}
        label="Images & video"
        hint="Shoppers see these in order on the product page. At least one image is required — it becomes the card thumbnail and the social preview. Videos play on tap, never automatically."
      />

      <div className="border-t pt-4">
        <label className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            checked={hasVariants}
            onChange={(e) => setHasVariants(e.target.checked)}
          />
          <span className="font-medium text-sm">
            This product has variants (size, color, etc.)
          </span>
        </label>

        {hasVariants ? (
          <VariantBuilder
            variants={variants}
            combinations={combinations}
            onVariantsChange={setVariants}
            onCombinationsChange={setCombinations}
          />
        ) : (
          <div>
            <label className="block text-sm font-medium mb-1">Stock</label>
            <input
              type="number"
              min={0}
              value={stock}
              onChange={(e) => setStock(Number(e.target.value))}
              className="w-32 rounded-md border px-3 py-2"
            />
          </div>
        )}
      </div>

      {/* ---- Fabric, fit and care ---- */}
      <div className="border-t pt-4 space-y-4">
        <h3 className="font-semibold text-sm">Fabric, fit &amp; care</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Fabric</label>
            <input
              value={fabric}
              onChange={(e) => setFabric(e.target.value)}
              placeholder="240 GSM combed cotton, bio-washed"
              className="w-full rounded-md border px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Fit</label>
            <input
              value={fitType}
              onChange={(e) => setFitType(e.target.value)}
              placeholder="Regular / Slim / Oversized"
              className="w-full rounded-md border px-3 py-2"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Care instructions</label>
          <textarea
            rows={2}
            value={careInstructions}
            onChange={(e) => setCareInstructions(e.target.value)}
            placeholder="Machine wash cold, inside out, with like colours…"
            className="w-full rounded-md border px-3 py-2"
          />
        </div>
        <div className="rounded-lg border bg-gray-50/50 p-4 space-y-4">
          <div>
            <h4 className="text-sm font-semibold">Product size chart</h4>
            <p className="mt-1 text-xs text-gray-500">
              Add a chart specifically for this product, or select a reusable chart created in
              Settings. The product-specific chart takes priority on the storefront.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={customChartEnabled}
              onChange={(e) => setCustomChartEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Add a custom chart for this product
          </label>

          {customChartEnabled ? (
            <div className="space-y-4 rounded-md border bg-white p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Chart title</label>
                  <input
                    value={sizeChartTitle}
                    onChange={(e) => setSizeChartTitle(e.target.value)}
                    placeholder="T-Shirt Size Guide"
                    className="w-full rounded-md border px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Measurement note</label>
                  <input
                    value={sizeChartUnitNote}
                    onChange={(e) => setSizeChartUnitNote(e.target.value)}
                    placeholder="All measurements in inches"
                    className="w-full rounded-md border px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Columns</label>
                <input
                  value={sizeChartColumns}
                  onChange={(e) => setSizeChartColumns(e.target.value)}
                  placeholder="Size, Chest, Length, Shoulder"
                  className="w-full rounded-md border px-3 py-2"
                />
                <p className="mt-1 text-xs text-gray-400">Separate column names with commas.</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Measurements</label>
                <textarea
                  rows={6}
                  value={sizeChartRows}
                  onChange={(e) => setSizeChartRows(e.target.value)}
                  placeholder={"S, 38, 27, 16.5\nM, 40, 28, 17.5\nL, 42, 29, 18.5"}
                  className="w-full rounded-md border px-3 py-2 font-mono text-sm"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Enter one size per line. Separate measurements with commas and match the number
                  of columns above.
                </p>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1">Reusable size chart</label>
            <select
              value={sizeChartKey}
              onChange={(e) => setSizeChartKey(e.target.value)}
              className="w-full rounded-md border px-3 py-2"
            >
              <option value="">No size chart</option>
              {sizeCharts.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.title || c.key}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400">
              Charts are managed under Settings → Size charts.
            </p>
            </div>
          )}
        </div>

        <div>
          <div>
            <label className="block text-sm font-medium mb-1">Product video</label>
            <p className="rounded-md border border-dashed px-3 py-2 text-xs text-gray-500">
              Add videos in the <strong>Images &amp; video</strong> gallery above — they appear in
              the same carousel as the photographs.
            </p>
          </div>
        </div>
      </div>

      {/* ---- Tax ---- */}
      <div className="border-t pt-4 space-y-4">
        <h3 className="font-semibold text-sm">Tax</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">HSN code</label>
            <input
              value={hsnCode}
              onChange={(e) => setHsnCode(e.target.value)}
              placeholder="6109"
              className="w-full rounded-md border px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">GST rate (%)</label>
            <input
              type="number"
              min={0}
              max={28}
              step="0.01"
              value={gstRate}
              onChange={(e) => setGstRate(e.target.value)}
              placeholder="Leave blank to use the default"
              className="w-full rounded-md border px-3 py-2"
            />
            <p className="mt-1 text-xs text-gray-400">
              Indian apparel: 5% under ₹1,000, 12% at or above. Blank inherits the default from
              Invoice Settings.
            </p>
          </div>
        </div>
      </div>

      {/* ---- Shipping ---- */}
      <div className="border-t pt-4 space-y-4">
        <h3 className="font-semibold text-sm">Shipping &amp; stock alerts</h3>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Weight (kg)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              className="w-full rounded-md border px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Length (cm)</label>
            <input
              type="number"
              min={0}
              value={lengthCm}
              onChange={(e) => setLengthCm(e.target.value)}
              className="w-full rounded-md border px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Breadth (cm)</label>
            <input
              type="number"
              min={0}
              value={breadthCm}
              onChange={(e) => setBreadthCm(e.target.value)}
              className="w-full rounded-md border px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Height (cm)</label>
            <input
              type="number"
              min={0}
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              className="w-full rounded-md border px-3 py-2"
            />
          </div>
        </div>
        <p className="text-xs text-gray-400">
          Couriers bill on the greater of dead and volumetric weight — under-declaring here is the
          usual cause of surcharges.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Low stock alert at</label>
            <input
              type="number"
              min={0}
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(e.target.value)}
              className="w-32 rounded-md border px-3 py-2"
            />
          </div>
          <label className="flex items-center gap-2 text-sm self-end pb-2">
            <input
              type="checkbox"
              checked={backInStockEnabled}
              onChange={(e) => setBackInStockEnabled(e.target.checked)}
            />
            Offer &ldquo;notify me&rdquo; when a size is sold out
          </label>
        </div>
      </div>

      {/* ---- SEO ---- */}
      <div className="border-t pt-4 space-y-4">
        <h3 className="font-semibold text-sm">SEO</h3>
        <div>
          <label className="block text-sm font-medium mb-1">Meta title</label>
          <input
            value={metaTitle}
            onChange={(e) => setMetaTitle(e.target.value)}
            placeholder="Falls back to the product title"
            className="w-full rounded-md border px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Meta description</label>
          <textarea
            rows={2}
            maxLength={300}
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value)}
            placeholder="Falls back to the first 160 characters of the description"
            className="w-full rounded-md border px-3 py-2"
          />
        </div>
      </div>

      <div className="flex gap-6 border-t pt-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isFeatured}
            onChange={(e) => setIsFeatured(e.target.checked)}
          />
          Featured
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active (visible in store)
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-primary text-primary-foreground px-6 py-2 font-medium disabled:opacity-50"
      >
        {saving ? "Saving..." : isEdit ? "Update Product" : "Create Product"}
      </button>
    </form>
  );
}
