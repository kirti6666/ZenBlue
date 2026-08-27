"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Upload, FileDown, AlertTriangle, Check } from "lucide-react";

interface ImportResult {
  dryRun: boolean;
  total: number;
  created: number;
  updated: number;
  failed: number;
  errors: { row: number; sku: string; message: string }[];
}

/**
 * Bulk CSV import.
 *
 * Defaults to a validation pass rather than a live import: the operator sees
 * exactly which rows would fail before anything touches the catalogue. That is
 * the difference between fixing four rows and unpicking a bad import of five
 * hundred products.
 */
export function ProductImport() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");

  async function submit(dryRun: boolean) {
    if (!file) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("dryRun", String(dryRun));

      const res = await fetch("/api/products/import", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Import failed");
      setResult(json);
      if (!dryRun) router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    const headers = [
      "sku",
      "title",
      "description",
      "category",
      "price",
      "discountPrice",
      "stock",
      "hsnCode",
      "gstRate",
      "fabric",
      "care",
      "fit",
      "weightKg",
      "lengthCm",
      "breadthCm",
      "heightCm",
      "lowStockThreshold",
      "tags",
      "images",
      "featured",
      "active",
    ];
    const example = [
      "ZB-TEE-NAVY",
      "Heavyweight Cotton Tee",
      "240 GSM combed cotton tee with a ribbed collar.",
      "T-Shirts",
      "1299",
      "",
      "24",
      "6109",
      "12",
      "240 GSM combed cotton",
      "Machine wash cold, inside out.",
      "Regular",
      "0.28",
      "30",
      "24",
      "4",
      "5",
      "tshirt;menswear",
      "https://res.cloudinary.com/…/tee.jpg",
      "no",
      "yes",
    ];
    const csv = `${headers.join(",")}\r\n${example.map((c) => (c.includes(",") ? `"${c}"` : c)).join(",")}`;
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "zenblue-product-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-heading">Bulk import from CSV</p>
          <p className="mt-1 max-w-lg text-xs text-muted">
            Products are matched on SKU — an existing SKU is updated, a new one is created. Run a
            check first to see any problems before anything is written.
          </p>
        </div>
        <button
          type="button"
          onClick={downloadTemplate}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3.5 py-2 text-sm text-heading hover:border-primary"
        >
          <FileDown size={14} />
          Template
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-line px-4 py-2.5 text-sm text-heading hover:border-primary">
          <Upload size={15} />
          {file ? file.name : "Choose a CSV file"}
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setResult(null);
            }}
          />
        </label>

        <button
          type="button"
          disabled={!file || busy}
          onClick={() => submit(true)}
          className="rounded-lg border border-line px-4 py-2.5 text-sm text-heading disabled:opacity-50"
        >
          {busy ? "Checking…" : "Check file"}
        </button>

        <button
          type="button"
          disabled={!file || busy}
          onClick={() => submit(false)}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Import
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-error">{error}</p>}

      {result && (
        <div className="mt-4 rounded-lg bg-surface-alt p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-heading">
            {result.failed === 0 ? (
              <Check size={15} className="text-success" />
            ) : (
              <AlertTriangle size={15} className="text-warning" />
            )}
            {result.dryRun ? "Check complete" : "Import complete"} — {result.total} row
            {result.total === 1 ? "" : "s"} read
          </p>
          <p className="mt-1 text-xs text-muted">
            {result.dryRun
              ? `${result.created} would be created or updated`
              : `${result.created} created, ${result.updated} updated`}
            {result.failed > 0 && `, ${result.failed} failed`}
          </p>

          {result.errors.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-line pt-3">
              {result.errors.map((e, i) => (
                <li key={i} className="text-xs text-error">
                  Row {e.row}
                  {e.sku ? ` (${e.sku})` : ""}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
