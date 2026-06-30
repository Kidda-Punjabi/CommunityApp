"use client";

import Link from "next/link";
import { useState } from "react";
import type { HelpContent, HelpSection } from "@/lib/help/types";
import { ui } from "@/lib/ui/styles";

type HelpArticlesViewProps = {
  content: HelpContent;
  backHref: string;
  backLabel?: string;
};

function HelpSectionBlock({ section }: { section: HelpSection }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section>
      <h2 className="text-lg font-semibold text-zinc-900">{section.title}</h2>
      {section.description && (
        <p className="mt-1 text-sm text-zinc-500">{section.description}</p>
      )}
      <div className="mt-4 divide-y divide-zinc-100 overflow-hidden rounded-3xl border border-zinc-200/80 bg-white">
        {section.articles.map((article) => {
          const isOpen = openId === article.id;
          return (
            <div key={article.id}>
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : article.id)}
                className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-zinc-50"
                aria-expanded={isOpen}
              >
                <span className="font-medium text-zinc-900">{article.question}</span>
                <span
                  className="mt-0.5 shrink-0 text-lg text-violet-500 transition-transform"
                  aria-hidden="true"
                  style={{ transform: isOpen ? "rotate(45deg)" : undefined }}
                >
                  +
                </span>
              </button>
              {isOpen && (
                <div className="border-t border-zinc-100 px-5 pb-4 pt-1">
                  <p className="text-sm leading-relaxed text-zinc-600">{article.answer}</p>
                  {article.links && article.links.length > 0 && (
                    <ul className="mt-4 flex flex-col gap-2">
                      {article.links.map((link) => (
                        <li key={`${article.id}-${link.href}`}>
                          <Link
                            href={link.href}
                            className="inline-flex items-center gap-1 text-sm font-semibold text-violet-600 hover:text-violet-500"
                          >
                            {link.label}
                            <span aria-hidden="true">→</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function HelpArticlesView({ content, backHref, backLabel = "Back to profile" }: HelpArticlesViewProps) {
  return (
    <div className={ui.page}>
      <Link
        href={backHref}
        className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        <span aria-hidden="true">←</span>
        {backLabel}
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{content.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">{content.intro}</p>
      </div>

      <div className="space-y-10">
        {content.sections.map((section) => (
          <HelpSectionBlock key={section.id} section={section} />
        ))}
      </div>
    </div>
  );
}
