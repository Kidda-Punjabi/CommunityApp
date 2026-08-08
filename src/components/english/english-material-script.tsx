import type { ReactNode } from "react";

/**
 * Render Punjabi-medium materials with English target terms highlighted.
 * Supports `[EN]term[/EN]`, `[EN]term`, and parenthetical Latin terms `(Democracy)`.
 */
export function renderEnglishMaterialScript(script: string) {
  const paragraphs = script
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return (
      <p className="text-sm text-zinc-500">No materials for this chapter yet.</p>
    );
  }

  return (
    <div className="space-y-4 text-[15px] leading-relaxed text-zinc-800">
      {paragraphs.map((paragraph, index) => (
        <p key={index} className="whitespace-pre-wrap">
          {renderInline(paragraph)}
        </p>
      ))}
    </div>
  );
}

function renderInline(text: string): ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // [EN]term[/EN] or [EN]term | (Latin phrase)
  const pattern =
    /\[EN\]([^[\]]+?)(?:\[\/EN\])?|\(([A-Za-z][A-Za-z0-9 &'/.-]{0,60})\)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }

    const tagged = match[1]?.trim();
    const paren = match[2]?.trim();
    const term = tagged || paren;
    if (term) {
      if (paren && !tagged) {
        nodes.push("(");
        nodes.push(
          <span
            key={`en-${key++}`}
            className="font-semibold text-emerald-800"
          >
            {paren}
          </span>
        );
        nodes.push(")");
      } else {
        nodes.push(
          <span
            key={`en-${key++}`}
            className="rounded-sm bg-emerald-50 px-0.5 font-semibold text-emerald-800"
          >
            {term}
          </span>
        );
      }
    }

    last = match.index + match[0].length;
  }

  if (last < text.length) {
    nodes.push(text.slice(last));
  }

  return nodes;
}
