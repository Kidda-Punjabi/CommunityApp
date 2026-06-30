import { deriveIconFromEnglish, hasEmojiIcon } from "./emojiMap";

const GURMUKHI = /[\u0A00-\u0A7F]/;

export type PictureMatchCard = {
  id: string;
  english: string;
  punjabi: string;
  romanised: string | null;
  icon_name: string;
  difficulty: number;
};

export type PictureMatchFlashcardRow = {
  id: string;
  front_text: string;
  back_text: string;
  romanised: string | null;
  icon_name: string | null;
  difficulty: number | null;
};

export function normalizePictureMatchCard(
  row: PictureMatchFlashcardRow
): PictureMatchCard | null {
  const front = row.front_text?.trim() ?? "";
  const back = row.back_text?.trim() ?? "";
  if (!front || !back) return null;

  const frontIsPunjabi = GURMUKHI.test(front);
  const backIsPunjabi = GURMUKHI.test(back);

  let english: string;
  let punjabi: string;

  if (!frontIsPunjabi && backIsPunjabi) {
    english = front;
    punjabi = back;
  } else if (frontIsPunjabi && !backIsPunjabi) {
    punjabi = front;
    english = back;
  } else {
    return null;
  }

  const iconName = row.icon_name?.trim() || deriveIconFromEnglish(english);
  if (!hasEmojiIcon(iconName)) return null;

  return {
    id: row.id,
    english,
    punjabi,
    romanised: row.romanised?.trim() || null,
    icon_name: iconName!,
    difficulty: row.difficulty ?? 1,
  };
}

export function buildPictureMatchPool(rows: PictureMatchFlashcardRow[]): PictureMatchCard[] {
  const seen = new Map<string, PictureMatchCard>();

  for (const row of rows) {
    const card = normalizePictureMatchCard(row);
    if (!card) continue;

    const key = card.punjabi;
    const existing = seen.get(key);
    if (!existing || (!existing.romanised && card.romanised)) {
      seen.set(key, card);
    }
  }

  return [...seen.values()];
}
