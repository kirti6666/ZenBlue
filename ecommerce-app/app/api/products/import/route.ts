import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Category, Product } from "@/models";
import { requireAdmin } from "@/lib/middleware/requireAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { logAdminAction, getClientIp } from "@/lib/middleware/logAdminAction";
import { parseCsvObjects } from "@/lib/csvParse";
import { slugify } from "@/lib/slugify";
import { adjustStock } from "@/lib/inventory";

export const dynamic = "force-dynamic";

const MAX_ROWS = 2000;

/**
 * Bulk product import from CSV.
 *
 * Two decisions shape this:
 *
 *  - **Upsert by SKU, not by title.** Titles get edited; SKUs are the stable
 *    identity. A row whose SKU already exists updates that product, so the same
 *    file can be re-uploaded after a correction without creating duplicates.
 *  - **Row-level error isolation.** One malformed row reports itself and the
 *    rest still import. An all-or-nothing import of 500 products that fails on
 *    row 400 is far more painful to recover from than a report saying which
 *    four rows need fixing.
 *
 * Stock changes go through adjustStock so an import lands in the same ledger as
 * every other movement, rather than silently rewriting levels.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, PERMISSIONS.PRODUCTS);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const form = await req.formData();
    const file = form.get("file");
    const dryRun = form.get("dryRun") === "true";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Attach a CSV file" }, { status: 400 });
    }

    const rows = parseCsvObjects(await file.text());
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "That file has no data rows — check it has a header row and at least one product" },
        { status: 400 }
      );
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `Too many rows (${rows.length}). Split the file into batches of ${MAX_ROWS}.` },
        { status: 400 }
      );
    }

    await connectDB();

    const categories = await Category.find({}).select("name slug").lean();
    const categoryByName = new Map(
      categories.flatMap((c: any) => [
        [c.name.toLowerCase(), c._id],
        [c.slug.toLowerCase(), c._id],
      ])
    );

    const created: string[] = [];
    const updated: string[] = [];
    const errors: { row: number; sku: string; message: string }[] = [];

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2; // +1 for the header, +1 for 1-based counting
      try {
        const title = row.title || row.name || "";
        const sku = row.sku || "";

        if (!title) throw new Error("Missing title");
        if (!sku) throw new Error("Missing SKU — it is the key used to match existing products");

        const price = Number(row.price);
        if (!Number.isFinite(price) || price <= 0) throw new Error("Price must be a number above 0");

        const categoryName = (row.category || "").toLowerCase();
        const categoryId = categoryByName.get(categoryName);
        if (!categoryId) throw new Error(`Unknown category "${row.category}"`);

        const stock = row.stock === "" || row.stock === undefined ? 0 : Number(row.stock);
        if (!Number.isFinite(stock) || stock < 0) throw new Error("Stock must be zero or more");

        const fields: Record<string, unknown> = {
          title,
          description: row.description || title,
          category: categoryId,
          price,
          sku,
          tags: (row.tags || "")
            .split(/[;|]/)
            .map((t) => t.trim())
            .filter(Boolean),
          hsnCode: row.hsncode || row.hsn || "",
          fabric: row.fabric || "",
          careInstructions: row.careinstructions || row.care || "",
          fitType: row.fit || row.fittype || "",
          metaTitle: row.metatitle || "",
          metaDescription: row.metadescription || "",
          isActive: row.active ? /^(y|yes|true|1)$/i.test(row.active) : true,
          isFeatured: row.featured ? /^(y|yes|true|1)$/i.test(row.featured) : false,
        };

        // Optional numerics: only set when the column carries a real value, so
        // a blank cell never overwrites an existing value with zero.
        const optionalNumbers: [string, string | undefined][] = [
          ["discountPrice", row.discountprice || row.saleprice],
          ["gstRate", row.gstrate || row.gst],
          ["weightKg", row.weightkg || row.weight],
          ["packageLengthCm", row.lengthcm || row.length],
          ["packageBreadthCm", row.breadthcm || row.breadth],
          ["packageHeightCm", row.heightcm || row.height],
          ["lowStockThreshold", row.lowstockthreshold || row.lowstock],
        ];
        for (const [key, raw] of optionalNumbers) {
          if (raw !== undefined && raw !== "") {
            const num = Number(raw);
            if (Number.isFinite(num)) fields[key] = num;
          }
        }

        if (row.images) {
          fields.images = row.images
            .split(/[;|]/)
            .map((u) => u.trim())
            .filter(Boolean);
        }

        if (dryRun) {
          created.push(sku);
          continue;
        }

        const existing = await Product.findOne({ sku });

        if (existing) {
          Object.assign(existing, fields);
          await existing.save();

          // Only touch stock when the column was actually supplied.
          if (row.stock !== undefined && row.stock !== "" && !existing.variantCombinations?.length) {
            const delta = stock - (existing.stock ?? 0);
            if (delta !== 0) {
              await adjustStock({
                productId: String(existing._id),
                delta,
                reason: "csv_import",
                note: `Import: ${file.name}`,
                performedBy: admin.id,
                suppressNotifications: true,
              });
            }
          }
          updated.push(sku);
        } else {
          const base = slugify(title);
          let slug = base;
          let suffix = 2;
          while (await Product.findOne({ slug })) slug = `${base}-${suffix++}`;

          const doc = await Product.create({
            ...fields,
            slug,
            images: (fields.images as string[]) ?? [],
            stock: 0,
            variants: [],
            variantCombinations: [],
            publishedAt: new Date(),
          });

          if (stock > 0) {
            await adjustStock({
              productId: String(doc._id),
              delta: stock,
              reason: "initial_stock",
              note: `Import: ${file.name}`,
              performedBy: admin.id,
              suppressNotifications: true,
            });
          }
          created.push(sku);
        }
      } catch (err) {
        errors.push({
          row: rowNumber,
          sku: row.sku || row.title || "",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (!dryRun) {
      await logAdminAction({
        adminId: admin.id,
        action: "PRODUCT_IMPORT",
        targetType: "Product",
        changes: {
          after: { file: file.name, created: created.length, updated: updated.length, failed: errors.length },
        },
        ipAddress: getClientIp(req),
      });
    }

    return NextResponse.json({
      dryRun,
      total: rows.length,
      created: created.length,
      updated: updated.length,
      failed: errors.length,
      // Capped so one badly-formed file cannot return a megabyte of errors.
      errors: errors.slice(0, 50),
    });
  } catch (err) {
    console.error("Product import error:", err);
    return NextResponse.json({ error: "Could not read that file" }, { status: 500 });
  }
}
