/**
 * Minimal RFC 4180 CSV parser.
 *
 * Written by hand rather than pulled from a package because the import path
 * needs exactly one thing — correct handling of quoted fields containing
 * commas, newlines and escaped quotes — and a product description with a comma
 * in it is the single most common reason a naive `split(",")` import corrupts a
 * catalogue.
 */

export function parseCsv(text: string): string[][] {
  // Strip a UTF-8 BOM (Excel writes one) and normalise line endings.
  const input = text.replace(/^﻿/, "");

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        // A doubled quote inside a quoted field is a literal quote.
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      // Consume the \n of a \r\n pair so it does not start an empty row.
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  // Flush whatever is left if the file does not end in a newline.
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop fully blank rows — trailing newlines are extremely common.
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/**
 * Parses into objects keyed by the header row, with headers normalised to a
 * lowercase, punctuation-free form so "Discount Price", "discount_price" and
 * "discountPrice" all resolve to the same key.
 */
export function parseCsvObjects(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];

  const headers = rows[0].map(normaliseHeader);

  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, i) => {
      if (header) obj[header] = (row[i] ?? "").trim();
    });
    return obj;
  });
}

export function normaliseHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}
