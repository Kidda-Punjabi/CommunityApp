"use client";

import { useState } from "react";

type ProductFaqProps = {
  items: Array<{ question: string; answer: string }>;
};

export function ProductFaq({ items }: ProductFaqProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="divide-y divide-zinc-100 overflow-hidden rounded-3xl border border-zinc-200/80 bg-white">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div key={item.question}>
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-zinc-50"
              aria-expanded={isOpen}
            >
              <span className="font-medium text-zinc-900">{item.question}</span>
              <span
                className="mt-0.5 shrink-0 text-lg text-violet-500 transition-transform"
                aria-hidden="true"
                style={{ transform: isOpen ? "rotate(45deg)" : undefined }}
              >
                +
              </span>
            </button>
            {isOpen && (
              <div className="border-t border-zinc-100 px-5 pb-4 pt-1 text-sm leading-relaxed text-zinc-600">
                {item.answer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
