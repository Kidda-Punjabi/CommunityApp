export const VOWEL_MATCH_GAME_TYPE = "vowel_match" as const;
export const VOWEL_MATCH_DISPLAY_NAME = "Vowel Match";

export type VowelMatchId =
  | "mukta"
  | "kanna"
  | "sihari"
  | "bihari"
  | "aunkar"
  | "dulainkar"
  | "lavan"
  | "dulavan"
  | "hora"
  | "kanaura";

export type VowelMatchOption = {
  id: VowelMatchId;
  symbol: string;
  name: string;
};

export const VOWEL_MATCH_OPTIONS: VowelMatchOption[] = [
  { id: "mukta", symbol: "◌", name: "Mukta (no matra)" },
  { id: "kanna", symbol: "ਾ", name: "Kanna (aa)" },
  { id: "sihari", symbol: "ਿ", name: "Sihari (i)" },
  { id: "bihari", symbol: "ੀ", name: "Bihari (ee)" },
  { id: "aunkar", symbol: "ੁ", name: "Aunkar (u)" },
  { id: "dulainkar", symbol: "ੂ", name: "Dulainkar (oo)" },
  { id: "lavan", symbol: "ੇ", name: "Lavan (e)" },
  { id: "dulavan", symbol: "ੈ", name: "Dulavan (ai)" },
  { id: "hora", symbol: "ੋ", name: "Hora (o)" },
  { id: "kanaura", symbol: "ੌ", name: "Kanaura (au)" },
];

const OPTION_BY_ID = new Map(VOWEL_MATCH_OPTIONS.map((option) => [option.id, option]));

export function isVowelMatchId(value: string): value is VowelMatchId {
  return OPTION_BY_ID.has(value as VowelMatchId);
}

export function vowelMatchOption(id: VowelMatchId): VowelMatchOption {
  return OPTION_BY_ID.get(id)!;
}

export function vowelMatchLabel(id: VowelMatchId): string {
  const option = vowelMatchOption(id);
  return `${option.symbol} — ${option.name}`;
}

export type VowelGameWord = {
  id: string;
  word_gurmukhi: string;
  meaning_english: string;
  romanised: string;
  vowels_tested: VowelMatchId[];
  audio_pa_url: string;
};

export type VowelMatchQuestion = {
  word: VowelGameWord;
  options: VowelMatchOption[];
};

export type VowelMatchQuestionResult = {
  word_id: string;
  word_gurmukhi: string;
  selected: VowelMatchId[];
  correct: VowelMatchId[];
  is_correct: boolean;
};

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function shuffleWithSeed<T>(items: T[], seed: string): T[] {
  const next = [...items];
  let hash = hashSeed(seed);
  for (let i = next.length - 1; i > 0; i -= 1) {
    hash = (Math.imul(hash, 1664525) + 1013904223) >>> 0;
    const j = hash % (i + 1);
    const current = next[i]!;
    next[i] = next[j]!;
    next[j] = current;
  }
  return next;
}

export function parseVowelsTested(raw: string[] | null | undefined): VowelMatchId[] {
  return (raw ?? []).filter(isVowelMatchId);
}

export function sameVowelSet(selected: VowelMatchId[], correct: VowelMatchId[]): boolean {
  if (selected.length !== correct.length) return false;
  const selectedSet = new Set(selected);
  return correct.every((id) => selectedSet.has(id));
}

export function encodeVowelAnswer(ids: readonly VowelMatchId[]): string {
  return [...ids].sort().join(",");
}

export function parseVowelAnswer(raw: string): VowelMatchId[] {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(isVowelMatchId);
}

export function buildVowelMatchOptions(
  correct: VowelMatchId[],
  seed: string
): VowelMatchOption[] {
  const correctSet = new Set(correct);
  const distractors = VOWEL_MATCH_OPTIONS.filter((option) => !correctSet.has(option.id));
  const needed = Math.max(0, 4 - correct.length);
  const picked = shuffleWithSeed(distractors, `${seed}-distractors`).slice(0, needed);
  const correctOptions = correct.map((id) => vowelMatchOption(id));
  return shuffleWithSeed([...correctOptions, ...picked], `${seed}-options`).slice(0, 4);
}

export function shuffleVowelMatchWords(words: VowelGameWord[]): VowelGameWord[] {
  return shuffleWithSeed(words, `session-${Date.now()}-${Math.random()}`);
}

export function buildVowelMatchRound(words: VowelGameWord[]): VowelMatchQuestion[] {
  return shuffleVowelMatchWords(words).map((word) => ({
    word,
    options: buildVowelMatchOptions(word.vowels_tested, word.id),
  }));
}
