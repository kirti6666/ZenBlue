"use client";

import { useEffect, useRef, useState } from "react";
import { Ruler, X } from "lucide-react";
import type { SizeChart } from "@/lib/site-settings";

/**
 * Size guide, opened from the variant selector.
 *
 * Sizing is the single largest driver of apparel returns, so the chart is one
 * tap from the size buttons rather than buried in a tab. Focus moves into the
 * dialog on open and Escape closes it, since this is a genuine modal.
 */
export function SizeChartModal({ chart }: { chart: SizeChart }) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-link underline underline-offset-4"
      >
        <Ruler size={13} />
        Size guide
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="size-chart-title"
        >
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />

          <div className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-line bg-surface p-6 shadow-2xl">
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close size guide"
              className="absolute right-4 top-4 text-muted hover:text-heading"
            >
              <X size={18} />
            </button>

            <h2 id="size-chart-title" className="pr-8 text-lg font-medium text-heading">
              {chart.title}
            </h2>
            {chart.unitNote && <p className="mt-1 text-xs text-muted">{chart.unitNote}</p>}

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[20rem] text-sm">
                <thead>
                  <tr>
                    {chart.columns.map((col) => (
                      <th
                        key={col}
                        className="border-b border-line px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chart.rows.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td
                          key={j}
                          className={`border-b border-line px-3 py-2.5 text-heading ${
                            j === 0 ? "font-medium" : "tabular-nums"
                          }`}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-5 rounded-lg bg-surface-alt p-3.5 text-xs leading-relaxed text-body">
              <strong className="text-heading">How to measure:</strong> lay a t-shirt you already
              own flat and measure across the chest one inch below the armhole. Match that number to
              the chest column. Between two sizes? Size up for a relaxed fit, down for a close one.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
