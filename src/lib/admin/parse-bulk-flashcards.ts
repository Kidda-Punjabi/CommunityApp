export type BulkFlashcardItem = { front_text: string; back_text: string };

function splitBulkLine(line: string): { front: string; back: string } | null {
  if (line.includes("\t")) {
    const parts = line.split("\t");
    const front = parts[0]?.trim();
    const back = parts.slice(1).join("\t").trim();
    if (front && back) return { front, back };
  }

  const pipeMatch = line.match(/^(.+?)\s*\|\s*(.+)$/);
  if (pipeMatch) {
    const front = pipeMatch[1]?.trim();
    const back = pipeMatch[2]?.trim();
    if (front && back) return { front, back };
  }

  const spaceMatch = line.match(/^(.+?)\s{2,}(.+)$/);
  if (spaceMatch) {
    const front = spaceMatch[1]?.trim();
    const back = spaceMatch[2]?.trim();
    if (front && back) return { front, back };
  }

  return null;
}

export function parseBulkFlashcards(raw: string): {
  items: BulkFlashcardItem[];
  errors: string[];
} {
  const items: BulkFlashcardItem[] = [];
  const errors: string[] = [];

  raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line, index) => {
      const parsed = splitBulkLine(line);
      if (!parsed) {
        errors.push(
          `Line ${index + 1} needs a tab, pipe (|), or two+ spaces between front and back.`
        );
        return;
      }
      items.push({ front_text: parsed.front, back_text: parsed.back });
    });

  return { items, errors };
}
