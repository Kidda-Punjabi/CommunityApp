import type { ReactNode } from "react";

type InlinePart = { type: "text" | "bold" | "email"; value: string };

function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const pattern = /(\*\*[^*]+\*\*|hello@kidda\.app)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      parts.push({ type: "text", value: text.slice(last, match.index) });
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push({ type: "bold", value: token.slice(2, -2) });
    } else {
      parts.push({ type: "email", value: token });
    }
    last = match.index + token.length;
  }
  if (last < text.length) {
    parts.push({ type: "text", value: text.slice(last) });
  }
  return parts.length > 0 ? parts : [{ type: "text", value: text }];
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return parseInline(text).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.type === "bold") {
      return (
        <strong key={key} className="font-semibold text-zinc-800">
          {part.value}
        </strong>
      );
    }
    if (part.type === "email") {
      return (
        <a
          key={key}
          href={`mailto:${part.value}`}
          className="font-semibold text-violet-600 hover:text-violet-500"
        >
          {part.value}
        </a>
      );
    }
    return <span key={key}>{part.value}</span>;
  });
}

/**
 * Lightweight markdown renderer for Help Centre articles.
 * Supports ## headings, paragraphs, **bold**, - lists, and hello@kidda.app links.
 * No new dependency — the app does not otherwise ship a markdown library.
 */
export function HelpMarkdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").trim().split("\n");
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let blockIndex = 0;

  function flushParagraph() {
    if (paragraph.length === 0) return;
    const text = paragraph.join(" ").trim();
    paragraph = [];
    if (!text) return;
    const key = `p-${blockIndex++}`;
    blocks.push(
      <p key={key} className="text-sm leading-relaxed text-zinc-600">
        {renderInline(text, key)}
      </p>
    );
  }

  function flushList() {
    if (listItems.length === 0) return;
    const items = [...listItems];
    listItems = [];
    const key = `ul-${blockIndex++}`;
    blocks.push(
      <ul key={key} className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-600">
        {items.map((item, index) => (
          <li key={`${key}-${index}`}>{renderInline(item, `${key}-${index}`)}</li>
        ))}
      </ul>
    );
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushParagraph();
      flushList();
      const title = trimmed.slice(3).trim();
      const key = `h-${blockIndex++}`;
      blocks.push(
        <h2 key={key} className="pt-2 text-base font-semibold text-zinc-900">
          {renderInline(title, key)}
        </h2>
      );
      continue;
    }

    if (trimmed.startsWith("- ")) {
      flushParagraph();
      listItems.push(trimmed.slice(2).trim());
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();

  return <div className="space-y-4">{blocks}</div>;
}
