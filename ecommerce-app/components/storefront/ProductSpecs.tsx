"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { RETURN_WINDOW_STATEMENT } from "@/lib/return-policy";

/**
 * Fabric, care and delivery detail, as collapsible panels below the buy box.
 *
 * "Fabric & fit" starts open because it is the information that closes a sale;
 * care and delivery are reference material the shopper opens if they want it.
 * Panels with no content are dropped rather than rendered empty.
 */
export function ProductSpecs({
  fabric,
  fitType,
  careInstructions,
  description,
  estimatedDelivery,
  returnPolicy,
}: {
  fabric?: string;
  fitType?: string;
  careInstructions?: string;
  description: string;
  estimatedDelivery: string;
  returnPolicy: string;
}) {
  const panels = [
    {
      key: "details",
      title: "Details",
      body: description,
    },
    (fabric || fitType) && {
      key: "fabric",
      title: "Fabric & fit",
      body: [fabric && `Fabric: ${fabric}`, fitType && `Fit: ${fitType}`]
        .filter(Boolean)
        .join("\n"),
    },
    careInstructions && { key: "care", title: "Care instructions", body: careInstructions },
    {
      key: "delivery",
      title: "Delivery & returns",
      body: `Estimated delivery: ${estimatedDelivery}.\n${returnPolicy}\n${RETURN_WINDOW_STATEMENT}`,
    },
  ].filter(Boolean) as { key: string; title: string; body: string }[];

  const [open, setOpen] = useState<string | null>(panels[0]?.key ?? null);

  return (
    <div className="mt-8 divide-y divide-line border-y border-line">
      {panels.map((panel) => {
        const isOpen = open === panel.key;
        return (
          <div key={panel.key}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : panel.key)}
              aria-expanded={isOpen}
              aria-controls={`panel-${panel.key}`}
              className="flex w-full items-center justify-between gap-4 py-4 text-left"
            >
              <span className="text-sm font-medium text-heading">{panel.title}</span>
              <ChevronDown
                size={16}
                className={`shrink-0 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </button>
            {isOpen && (
              <div
                id={`panel-${panel.key}`}
                className="whitespace-pre-line pb-5 text-sm leading-relaxed text-body"
              >
                {panel.body}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
