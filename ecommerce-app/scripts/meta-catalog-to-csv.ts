/**
 * Converts a Meta (Facebook/Instagram/WhatsApp) catalogue export into the CSV
 * that Admin → Products → Bulk import expects.
 *
 *   npx tsx scripts/meta-catalog-to-csv.ts <meta-export.csv> [out.csv]
 *
 * Why this exists: a WhatsApp catalogue has no readable public URL. The
 * wa.me/c/<number> link opens the WhatsApp app against a logged-in session —
 * there is nothing there for a server to fetch. The catalogue behind it lives
 * in Meta Commerce Manager, which exports the same data as a Google-Shopping
 * style CSV. That export is the supported way out, and this maps its columns
 * onto ours.
 *
 * Export path: business.facebook.com → Commerce Manager → your catalogue →
 * Catalogue → Items → "Export items" → CSV.
 *
 * Anything the export cannot tell us (SKU when there is no id, GST rate, HSN,
 * category) is filled from the rules below and flagged in the run summary, so
 * the gaps are visible before the file is imported rather than after.
 */
import fs from "node:fs";
import path from "node:path";
import { parseCsvObjects } from "../lib/csvParse";

/**
 * parseCsvObjects normalises headers to lowercase with punctuation removed, so
 * Meta's `image_link` arrives as `imagelink` and `sale_price` as `saleprice`.
 * Every column read below uses that normalised form.
 */

/** Our importer's header, in the order the downloadable template uses. */
const OUT_COLUMNS = [
  "sku", "title", "description", "category", "price", "discountPrice", "stock",
  "hsnCode", "gstRate", "fabric", "care", "fit", "weightKg", "lengthCm",
  "breadthCm", "heightCm", "lowStockThreshold", "tags", "images",
  "featured", "active",
];

/** Apparel under ₹1,000 is 5% GST in India; at or above, 12%. */
const gstFor = (price: number) => (price < 1000 ? 5 : 12);

/**
 * Meta prices are "1299.00 INR" or "₹1,299.00" depending on how the catalogue
 * was built. Strip everything that is not a digit or a decimal point.
 */
function money(raw: string): number {
  const n = Number(String(raw ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/**
 * Best-effort category from the item's own words. Meta's `product_type` and
 * `google_product_category` are free text and often empty, so the title is a
 * more reliable signal than either.
 */
function categoryFor(row: Record<string, string>): string {
  const hay = [row.producttype, row.googleproductcategory, row.title, row.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/\b(combo|pack of|set of|bundle)\b/.test(hay)) return "Combo";
  if (/\b(t-?shirt|tee)\b/.test(hay)) return "T Shirts";
  if (/\bpolo\b/.test(hay)) return "T Shirts";
  if (/\bshirt\b/.test(hay)) return "Shirts";
  return "Shirts";
}

/** Meta joins extra images with a comma; ours uses a semicolon. */
function images(row: Record<string, string>): string {
  return [row.imagelink, ...String(row.additionalimagelink ?? "").split(",")]
    .map((u) => String(u ?? "").trim())
    .filter(Boolean)
    .join(";");
}

/** A stable, readable SKU when the export has no id of its own. */
function skuFor(row: Record<string, string>, i: number): string {
  const given = (row.id || row.retailerid || row.sku || "").trim();
  if (given) return given;
  const slug = (row.title || "item")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 22);
  return `ZB-${slug}-${String(i + 1).padStart(3, "0")}`;
}

function csvCell(value: string): string {
  const s = String(value ?? "");
  // A leading =, +, - or @ makes Excel treat the cell as a formula. Prefixing
  // an apostrophe keeps it text — the same guard the export side uses.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function main() {
  const [input, output] = process.argv.slice(2);
  if (!input) {
    console.error("Usage: npx tsx scripts/meta-catalog-to-csv.ts <meta-export.csv> [out.csv]");
    process.exit(1);
  }
  if (!fs.existsSync(input)) {
    console.error(`No such file: ${path.resolve(input)}`);
    process.exit(1);
  }

  const rows = parseCsvObjects(fs.readFileSync(input, "utf8"));
  if (rows.length === 0) {
    console.error("That export has no data rows.");
    process.exit(1);
  }

  const out: string[] = [OUT_COLUMNS.join(",")];
  const notes = { noPrice: 0, noImage: 0, guessedSku: 0, outOfStock: 0 };

  rows.forEach((row, i) => {
    const price = money(row.price);
    const sale = money(row.saleprice);
    if (!price) notes.noPrice++;
    if (!images(row)) notes.noImage++;
    if (!(row.id || row.retailerid || row.sku)) notes.guessedSku++;

    // Meta carries availability, not a count. "in stock" seeds an opening
    // quantity you correct in Admin → Inventory; anything else seeds zero,
    // which is the safe direction to be wrong in.
    const inStock = /^in ?stock$/i.test(String(row.availability ?? "").trim());
    if (!inStock) notes.outOfStock++;

    const record: Record<string, string> = {
      sku: skuFor(row, i),
      title: row.title || "",
      description: row.description || row.title || "",
      category: categoryFor(row),
      price: String(price),
      // Meta's sale_price is only a discount when it undercuts the list price.
      discountPrice: sale && sale < price ? String(sale) : "",
      stock: inStock ? "10" : "0",
      hsnCode: "6105",
      gstRate: String(gstFor(price)),
      fabric: row.material || "",
      care: "",
      fit: "",
      weightKg: "0.35",
      lengthCm: "30", breadthCm: "24", heightCm: "4",
      lowStockThreshold: "5",
      tags: [row.brand, row.color, row.producttype].filter(Boolean).join(";"),
      images: images(row),
      featured: "no",
      active: inStock ? "yes" : "no",
    };

    out.push(OUT_COLUMNS.map((c) => csvCell(record[c])).join(","));
  });

  const dest = output || input.replace(/\.csv$/i, "") + ".zenblue.csv";
  fs.writeFileSync(dest, out.join("\n"), "utf8");

  console.log(`\n  ${rows.length} items → ${dest}\n`);
  console.log("  Check before importing:");
  console.log(`   · ${notes.outOfStock} item(s) seeded at 0 stock (not "in stock" in the export)`);
  if (notes.noPrice)     console.log(`   · ${notes.noPrice} item(s) have no price — the import will reject these rows`);
  if (notes.noImage)     console.log(`   · ${notes.noImage} item(s) have no image URL`);
  if (notes.guessedSku)  console.log(`   · ${notes.guessedSku} SKU(s) generated from the title`);
  console.log("   · Category guessed from the title — fix any that landed wrong");
  console.log("   · HSN set to 6105 for every row; split it if your styles differ\n");
  console.log("  Then: Admin → Products → Bulk import, tick 'Dry run' first.\n");
}

main();
