"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Card } from "./AdminPage";

const EXPORTS = [
  { type: "orders", label: "Orders", hint: "One row per order, with totals, tax and shipping" },
  { type: "order-items", label: "Order line items", hint: "One row per product sold — best for sell-through" },
  { type: "products", label: "Product catalogue", hint: "Prices, stock, HSN and sales counts" },
  { type: "customers", label: "Customers", hint: "With order counts and lifetime value" },
  { type: "returns", label: "Returns & refunds", hint: "Every request with its resolution" },
  { type: "subscribers", label: "Newsletter subscribers", hint: "Active opt-ins only" },
];

/**
 * CSV download panel.
 *
 * Navigates to the export URL rather than fetching and building a Blob: the
 * browser handles the download natively, the Content-Disposition filename is
 * respected, and a large export never has to be held in memory on the client.
 */
export function ExportPanel() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function download(type: string) {
    const params = new URLSearchParams({ type });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    window.location.href = `/api/reports/export?${params}`;
  }

  return (
    <Card>
      <div className="mb-5 flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-heading">From</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-heading"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-heading">To</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-heading"
          />
        </label>
        {(from || to) && (
          <button
            type="button"
            onClick={() => {
              setFrom("");
              setTo("");
            }}
            className="pb-2 text-sm text-link underline underline-offset-4"
          >
            Clear dates
          </button>
        )}
        <p className="pb-2 text-xs text-muted">
          Dates apply to orders, customers and returns. Catalogue and subscriber
          exports always return everything.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {EXPORTS.map((exp) => (
          <button
            key={exp.type}
            type="button"
            onClick={() => download(exp.type)}
            className="flex items-start gap-3 rounded-lg border border-line p-4 text-left transition-colors hover:border-primary"
          >
            <Download size={16} className="mt-0.5 shrink-0 text-muted" />
            <span>
              <span className="block text-sm font-medium text-heading">{exp.label}</span>
              <span className="mt-0.5 block text-xs text-muted">{exp.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
}
