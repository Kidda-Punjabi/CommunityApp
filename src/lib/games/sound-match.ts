import { gurmukhiOptionName } from "@/lib/learn/gurmukhi-letter-names";

export const SOUND_MATCH_GAME_TYPE = "sound_match" as const;
export const SOUND_MATCH_DISPLAY_NAME = "Sound Match";
export const SOUND_MATCH_QUESTION_COUNTS = [5, 10, 15, 20] as const;
export const SOUND_MATCH_FULL_ID = "full" as const;

export type SoundMatchGroupId =
  | "unaspirated_aspirated"
  | "voiced_aspirated"
  | "retroflex_dental"
  | "nasals";

export type SoundMatchSelectionId = SoundMatchGroupId | typeof SOUND_MATCH_FULL_ID;
export type SoundMatchPair = readonly [string, string];

export type SoundMatchGroup = {
  id: SoundMatchGroupId;
  label: string;
  description: string;
  letters: readonly string[];
  pairs: readonly SoundMatchPair[];
};

export const SOUND_MATCH_GROUPS: readonly SoundMatchGroup[] = [
  {
    id: "unaspirated_aspirated",
    label: "Unaspirated vs aspirated",
    description: "Same-row pairs — ਕ/ਖ, ਚ/ਛ, ਟ/ਠ, ਤ/ਥ, ਪ/ਫ",
    pairs: [
      ["ਕ", "ਖ"],
      ["ਚ", "ਛ"],
      ["ਟ", "ਠ"],
      ["ਤ", "ਥ"],
      ["ਪ", "ਫ"],
    ],
    letters: ["ਕ", "ਖ", "ਚ", "ਛ", "ਟ", "ਠ", "ਤ", "ਥ", "ਪ", "ਫ"],
  },
  {
    id: "voiced_aspirated",
    label: "Voiced unaspirated vs aspirated",
    description: "Voiced pairs — ਗ/ਘ, ਜ/ਝ, ਡ/ਢ, ਦ/ਧ, ਬ/ਭ",
    pairs: [
      ["ਗ", "ਘ"],
      ["ਜ", "ਝ"],
      ["ਡ", "ਢ"],
      ["ਦ", "ਧ"],
      ["ਬ", "ਭ"],
    ],
    letters: ["ਗ", "ਘ", "ਜ", "ਝ", "ਡ", "ਢ", "ਦ", "ਧ", "ਬ", "ਭ"],
  },
  {
    id: "retroflex_dental",
    label: "Retroflex vs dental",
    description: "Place-of-articulation pairs — ਟ/ਤ, ਡ/ਦ, ਠ/ਥ, ਢ/ਧ, ਣ/ਨ",
    pairs: [
      ["ਟ", "ਤ"],
      ["ਡ", "ਦ"],
      ["ਠ", "ਥ"],
      ["ਢ", "ਧ"],
      ["ਣ", "ਨ"],
    ],
    letters: ["ਟ", "ਤ", "ਡ", "ਦ", "ਠ", "ਥ", "ਢ", "ਧ", "ਣ", "ਨ"],
  },
  {
    id: "nasals",
    label: "Nasals",
    description: "ਙ, ਞ, ਣ, ਨ, ਮ",
    pairs: [],
    letters: ["ਙ", "ਞ", "ਣ", "ਨ", "ਮ"],
  },
];

export type SoundMatchLetter = {
  glyph: string;
  audioUrl: string;
};

export type SoundMatchQuestion = {
  letter: string;
  audioUrl: string;
  options: string[];
};

export type SoundMatchQuestionResult = {
  letter: string;
  selected: string;
  options: string[];
  is_correct: boolean;
};

export function letterLabel(glyph: string): string {
  const name = gurmukhiOptionName(glyph);
  return name ? `${glyph}  ${name}` : glyph;
}

export function uniqueLetters(glyphs: readonly string[]): string[] {
  return [...new Set(glyphs)];
}

export function isFullAlphabet(selected: readonly string[]): boolean {
  return selected.includes(SOUND_MATCH_FULL_ID) || selected.length === 0;
}

export function activeGroupIds(selected: readonly string[]): SoundMatchGroupId[] {
  if (isFullAlphabet(selected)) {
    return SOUND_MATCH_GROUPS.map((group) => group.id);
  }
  const wanted = new Set(selected);
  return SOUND_MATCH_GROUPS.filter((group) => wanted.has(group.id)).map((group) => group.id);
}

export function lettersForSelection(selected: readonly string[]): string[] {
  const ids = new Set(activeGroupIds(selected));
  return uniqueLetters(
    SOUND_MATCH_GROUPS.filter((group) => ids.has(group.id)).flatMap((group) => [...group.letters])
  );
}

function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Prefer the pair-mate, then other letters from the same confusable group(s). */
export function buildOptions(
  correct: string,
  pool: readonly string[],
  groupIds: readonly SoundMatchGroupId[]
): string[] {
  const poolSet = new Set(pool);
  if (!poolSet.has(correct)) return [correct];

  const pairMates: string[] = [];
  const sameGroup: string[] = [];

  for (const group of SOUND_MATCH_GROUPS) {
    if (!groupIds.includes(group.id) || !group.letters.includes(correct)) continue;
    for (const [left, right] of group.pairs) {
      if (left === correct && poolSet.has(right)) pairMates.push(right);
      if (right === correct && poolSet.has(left)) pairMates.push(left);
    }
    for (const other of group.letters) {
      if (other !== correct && poolSet.has(other)) sameGroup.push(other);
    }
  }

  const preferred = uniqueLetters([...pairMates, ...shuffle(sameGroup)]).filter(
    (glyph) => glyph !== correct
  );
  const rest = shuffle(pool.filter((glyph) => glyph !== correct && !preferred.includes(glyph)));
  const optionCount = pool.length <= 2 ? 2 : Math.min(4, pool.length);
  const distractors = [...preferred, ...rest].slice(0, Math.max(0, optionCount - 1));
  return shuffle([correct, ...distractors]);
}

export function pickNonConsecutive(pool: readonly string[], count: number): string[] {
  if (pool.length === 0 || count <= 0) return [];
  if (pool.length === 1) return Array.from({ length: count }, () => pool[0]);

  const result: string[] = [];
  let shuffled = shuffle(pool);
  let index = 0;
  let guard = 0;

  while (result.length < count && guard < count * 40) {
    guard += 1;
    if (index >= shuffled.length) {
      shuffled = shuffle(pool);
      index = 0;
    }
    const next = shuffled[index];
    index += 1;
    if (result.length > 0 && next === result[result.length - 1]) continue;
    result.push(next);
  }

  while (result.length < count) {
    const last = result[result.length - 1];
    const candidates = pool.filter((glyph) => glyph !== last);
    result.push(candidates[Math.floor(Math.random() * candidates.length)] ?? pool[0]);
  }

  return result;
}

export function buildSoundMatchRound(
  letters: SoundMatchLetter[],
  selected: readonly string[],
  questionCount: number
): SoundMatchQuestion[] {
  const wanted = new Set(lettersForSelection(selected));
  const available = letters.filter((letter) => wanted.has(letter.glyph) && letter.audioUrl);
  if (available.length === 0) return [];

  const byGlyph = new Map(available.map((letter) => [letter.glyph, letter]));
  const pool = [...byGlyph.keys()];
  const groupIds = activeGroupIds(selected);
  const sequence = pickNonConsecutive(pool, questionCount);

  return sequence.flatMap((glyph) => {
    const letter = byGlyph.get(glyph);
    if (!letter) return [];
    return [
      {
        letter: glyph,
        audioUrl: letter.audioUrl,
        options: buildOptions(glyph, pool, groupIds),
      },
    ];
  });
}
