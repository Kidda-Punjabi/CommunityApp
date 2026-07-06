export type BulkFlashcardItem = { front_text: string; back_text: string };

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
      const parts = line.split("\t");
      if (parts.length < 2) {
        errors.push(`Line ${index + 1} is missing a tab separator and was skipped.`);
        return;
      }
      const front = parts[0]?.trim();
      const back = parts.slice(1).join("\t").trim();
      if (!front || !back) {
        errors.push(`Line ${index + 1} is incomplete and was skipped.`);
        return;
      }
      items.push({ front_text: front, back_text: back });
    });

  return { items, errors };
}
