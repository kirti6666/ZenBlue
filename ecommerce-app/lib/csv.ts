/**
 * CSV generation for the admin exports.
 *
 * Two details that matter more than they look:
 *
 *  - Formula injection: a cell beginning with =, +, -, or @ is executed as a
 *    formula when the file is opened in Excel or Sheets. An order with the
 *    shipping name "=cmd|…" becomes a live attack on whoever opens the export.
 *    Such cells are prefixed with a single quote, which Excel strips on display.
 *  - The BOM: without it Excel on Windows reads UTF-8 as Latin-1, and every
 *    rupee sign and accented name in the file renders as mojibake.
 */

export type CsvValue = string | number | boolean | Date | null | undefined;

function escapeCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";

  let str =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "boolean"
        ? value
          ? "Yes"
          : "No"
        : String(value);

  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;

  // Quote anything containing a delimiter, quote or newline; double inner quotes.
  if (/[",\n\r]/.test(str)) str = `"${str.replace(/"/g, '""')}"`;

  return str;
}

export function toCsv(
  rows: Record<string, CsvValue>[],
  columns: { key: string; label: string }[]
): string {
  const header = columns.map((c) => escapeCell(c.label)).join(",");
  const body = rows.map((row) => columns.map((c) => escapeCell(row[c.key])).join(",")).join("\r\n");
  // UTF-8 BOM so Excel picks the right encoding.
  return `﻿${header}\r\n${body}`;
}

/** Wraps CSV text in a downloadable Response with a dated filename. */
export function csvResponse(csv: string, filename: string): Response {
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
