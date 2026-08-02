export const JEOPARDY_CATEGORIES = ["alphabet", "vocab", "sentences"] as const;
export type JeopardyCategory = (typeof JEOPARDY_CATEGORIES)[number];

export const JEOPARDY_POINT_VALUES = [100, 200, 300, 400, 500] as const;

export const JEOPARDY_CATEGORY_LABELS: Record<JeopardyCategory, string> = {
  alphabet: "Alphabet",
  vocab: "Vocab",
  sentences: "Sentences",
};
