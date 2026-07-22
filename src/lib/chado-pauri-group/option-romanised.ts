import type { LadderQuestionPayload } from "@/lib/chado-pauri-group/ladder-questions";
import { latinRomanised } from "@/lib/conjugation/romanised";
import type { ChadoPauriFlashcard } from "@/lib/games/chado-pauri/types";

export function buildBackTextRomanisedMap(
  cards: ChadoPauriFlashcard[]
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const card of cards) {
    const romanised = latinRomanised(card.romanised);
    if (romanised) {
      map[card.back_text.trim()] = romanised;
    }
  }
  return map;
}

export function enrichLadderPayloadRomanisation(
  payload: LadderQuestionPayload,
  cards: ChadoPauriFlashcard[]
): LadderQuestionPayload {
  const fromCards = buildBackTextRomanisedMap(cards);
  const merged = { ...payload.option_romanised, ...fromCards };
  const option_romanised: Record<string, string> = {};
  for (const opt of payload.options) {
    const key = opt.trim();
    const romanised = merged[opt] ?? merged[key];
    if (romanised) option_romanised[opt] = romanised;
  }
  return Object.keys(option_romanised).length
    ? { ...payload, option_romanised }
    : payload;
}

export function resolveOptionRomanised(
  payload: LadderQuestionPayload,
  optionText: string,
  fallbackByBackText: Record<string, string>
): string | null {
  const fromPayload = payload.option_romanised?.[optionText];
  if (fromPayload) return latinRomanised(fromPayload);
  return latinRomanised(fallbackByBackText[optionText.trim()] ?? null);
}
