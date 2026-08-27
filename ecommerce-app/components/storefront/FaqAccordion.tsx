"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";

/**
 * Accordion for FAQ entries.
 *
 * Built on real <button> elements with aria-expanded/aria-controls rather than
 * <details>, so the open/closed state can be styled and animated consistently
 * across browsers while staying keyboard- and screen-reader-friendly.
 */
export function FaqAccordion({ items }: { items: { question: string; answer: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="divide-y divide-line rounded-xl border border-line bg-surface">
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={i}>
            <h3>
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : i)}
                aria-expanded={isOpen}
                aria-controls={`faq-panel-${i}`}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span className="font-display text-base font-normal leading-snug text-heading sm:text-[17px]">
                  {item.question}
                </span>
                <span className="shrink-0 text-muted">
                  {isOpen ? <Minus size={16} /> : <Plus size={16} />}
                </span>
              </button>
            </h3>
            {isOpen && (
              <div
                id={`faq-panel-${i}`}
                className="px-5 pb-5 font-display text-[15px] leading-relaxed text-body sm:text-base"
              >
                {item.answer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
