import { formatTenseLabel } from "@/lib/conjugation/distractors";
import type { TenseGroup, TenseId } from "@/lib/conjugation/types";
import { TENSE_CATALOG } from "@/lib/conjugation/types";
import {
  NECESSITY_PRESENT_AUX,
  OBLIQUE_PRONOUNS,
  PAST_AUX,
  PRESENT_AUX,
  SUBJECT_PRONOUNS,
} from "@/lib/conjugation/pronouns";
import { isMixedFilter } from "@/lib/games/session-settings";
import type { DistractorConjugation, GrammarSentence, WordTile } from "@/lib/games/types";

export function parseWordTiles(raw: unknown): WordTile[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry) => {
      if (typeof entry === "string") {
        const gurmukhi = entry.trim();
        return gurmukhi ? { gurmukhi, romanised: "" } : null;
      }

      if (!entry || typeof entry !== "object") return null;

      const record = entry as Record<string, unknown>;
      const gurmukhi = String(record.gurmukhi ?? "").trim();
      if (!gurmukhi) return null;

      return {
        gurmukhi,
        romanised: String(record.romanised ?? "").trim(),
      };
    })
    .filter((entry): entry is WordTile => entry !== null);
}

export function wordTileLabel(tile: WordTile | string): string {
  return typeof tile === "string" ? tile : tile.gurmukhi;
}

export function buildRomanisedSentenceFromTiles(sentence: GrammarSentence): string {
  return sentence.word_tiles
    .map((tile) => tile.romanised.trim())
    .filter(Boolean)
    .join(" ");
}

export function buildGapSentenceRomanised(sentence: GrammarSentence): string | undefined {
  const targetVerb = sentence.target_verb_gurmukhi?.trim();
  const targetVerbRomanised = sentence.target_verb_romanised?.trim();
  if (!targetVerb) return undefined;

  if (targetVerbRomanised) {
    const fullLine = buildRomanisedSentenceFromTiles(sentence);
    if (fullLine) {
      const index = fullLine.indexOf(targetVerbRomanised);
      if (index !== -1) {
        return (
          fullLine.slice(0, index) +
          "___" +
          fullLine.slice(index + targetVerbRomanised.length)
        );
      }
    }
  }

  const parts = sentence.word_tiles.map((tile) => {
    if (tile.gurmukhi === targetVerb) return "___";
    return tile.romanised.trim();
  });

  const line = parts.filter(Boolean).join(" ");
  return line || undefined;
}

export function parseDistractorConjugations(raw: unknown): DistractorConjugation[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const gurmukhi = String(record.gurmukhi ?? "").trim();
      if (!gurmukhi) return null;
      return {
        gurmukhi,
        romanised: String(record.romanised ?? "").trim(),
      };
    })
    .filter((entry): entry is DistractorConjugation => entry !== null);
}

export function normalizeGrammarSentence(row: Record<string, unknown>): GrammarSentence {
  return {
    id: String(row.id),
    punjabi_sentence: String(row.punjabi_sentence ?? ""),
    english_translation: String(row.english_translation ?? ""),
    word_tiles: parseWordTiles(row.word_tiles),
    difficulty: typeof row.difficulty === "number" ? row.difficulty : 1,
    topic_tags: Array.isArray(row.topic_tags) ? row.topic_tags.map(String) : [],
    course_id: row.course_id ? String(row.course_id) : null,
    lesson_id: row.lesson_id ? String(row.lesson_id) : null,
    tense: row.tense ? String(row.tense) : null,
    is_question: Boolean(row.is_question),
    question_type: row.question_type ? String(row.question_type) : null,
    is_negative: Boolean(row.is_negative),
    target_verb_gurmukhi: row.target_verb_gurmukhi
      ? String(row.target_verb_gurmukhi)
      : null,
    target_verb_romanised: row.target_verb_romanised
      ? String(row.target_verb_romanised)
      : null,
    target_verb_root_gurmukhi: row.target_verb_root_gurmukhi
      ? String(row.target_verb_root_gurmukhi)
      : null,
    target_verb_root_romanised: row.target_verb_root_romanised
      ? String(row.target_verb_root_romanised)
      : null,
    distractor_conjugations: parseDistractorConjugations(row.distractor_conjugations),
    created_at: String(row.created_at ?? ""),
  };
}

export function mapGrammarTenseToCatalogId(tense: string): TenseId | null {
  if (TENSE_CATALOG.some((entry) => entry.id === tense)) {
    return tense as TenseId;
  }

  const prefixMatch = TENSE_CATALOG.find(
    (entry) => tense.startsWith(`${entry.id}_`) || tense.startsWith(`${entry.id}`)
  );
  return prefixMatch?.id ?? null;
}

export function tenseGroupFromGrammarTense(tense: string | null): TenseGroup {
  if (!tense) return "present";
  if (tense.startsWith("past")) return "past";
  if (tense.startsWith("future")) return "future";
  return "present";
}

export function formatGrammarTenseLabel(tense: string | null): string {
  if (!tense) return "Grammar practice";

  const catalogId = mapGrammarTenseToCatalogId(tense);
  if (catalogId) {
    return formatTenseLabel(catalogId);
  }

  return tense
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function matchesTenseSelection(
  sentenceTense: string | null,
  availableTenses: TenseId[]
): boolean {
  if (!sentenceTense || availableTenses.length === 0) return false;
  if (availableTenses.includes(sentenceTense as TenseId)) return true;

  if (
    availableTenses.some(
      (tenseId) =>
        sentenceTense === tenseId || sentenceTense.startsWith(`${tenseId}_`)
    )
  ) {
    return true;
  }

  const catalogId = mapGrammarTenseToCatalogId(sentenceTense);
  if (catalogId && availableTenses.includes(catalogId)) {
    return true;
  }

  const group = tenseGroupFromGrammarTense(sentenceTense);
  const groupTenseIds = TENSE_CATALOG.filter((entry) => entry.group === group).map(
    (entry) => entry.id
  );
  return groupTenseIds.every((tenseId) => availableTenses.includes(tenseId));
}

export function filterGrammarSentencesByTense(
  sentences: GrammarSentence[],
  availableTenses: TenseId[]
): GrammarSentence[] {
  return sentences.filter((sentence) =>
    matchesTenseSelection(sentence.tense, availableTenses)
  );
}

export function filterGrammarSentencesByTenseValue(
  sentences: GrammarSentence[],
  tenseFilter: string | string[]
): GrammarSentence[] {
  if (isMixedFilter(tenseFilter)) return sentences;

  const ids = Array.isArray(tenseFilter) ? tenseFilter : [tenseFilter];
  const allowed = new Set(ids.filter((id) => !isMixedFilter(id)));
  if (allowed.size === 0) return sentences;

  return sentences.filter((sentence) => sentence.tense != null && allowed.has(sentence.tense));
}

export function grammarTenseFilterOptions(
  sentences: GrammarSentence[]
): { id: string; label: string }[] {
  const tenseSet = new Set<string>();
  for (const sentence of sentences) {
    if (sentence.tense?.trim()) {
      tenseSet.add(sentence.tense.trim());
    }
  }

  const options = [...tenseSet]
    .sort((a, b) => a.localeCompare(b))
    .map((tense) => ({
      id: tense,
      label: formatGrammarTenseLabel(tense),
    }));

  return [{ id: "mixed", label: "Mixed (all tenses)" }, ...options];
}

export function buildGrammarTileLexicon(sentences: GrammarSentence[]): Map<string, string> {
  const lexicon = new Map<string, string>();

  const addPair = (gurmukhi: string | null | undefined, romanised: string | null | undefined) => {
    const word = gurmukhi?.trim();
    const latin = romanised?.trim();
    if (!word || !latin || lexicon.has(word)) return;
    lexicon.set(word, latin);
  };

  for (const pronoun of Object.values(SUBJECT_PRONOUNS)) {
    addPair(pronoun.punjabi, pronoun.romanised);
  }
  for (const pronoun of Object.values(OBLIQUE_PRONOUNS)) {
    addPair(pronoun.punjabi, pronoun.romanised);
  }
  for (const aux of Object.values(PRESENT_AUX)) {
    addPair(aux.punjabi, aux.romanised);
  }
  for (const aux of Object.values(PAST_AUX)) {
    addPair(aux.punjabi, aux.romanised);
  }
  for (const aux of Object.values(NECESSITY_PRESENT_AUX)) {
    addPair(aux.punjabi, aux.romanised);
  }

  for (const sentence of sentences) {
    addPair(sentence.target_verb_gurmukhi, sentence.target_verb_romanised);
    addPair(sentence.target_verb_root_gurmukhi, sentence.target_verb_root_romanised);
    for (const tile of sentence.word_tiles) {
      addPair(tile.gurmukhi, tile.romanised);
    }
    for (const distractor of sentence.distractor_conjugations) {
      addPair(distractor.gurmukhi, distractor.romanised);
    }
  }

  return lexicon;
}

export function lookupGrammarRomanised(
  lexicon: Map<string, string>,
  word: string
): string {
  return lexicon.get(word) ?? "";
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function broadenSentencePool(
  allSentences: GrammarSentence[],
  filteredSentences: GrammarSentence[]
): GrammarSentence[] {
  if (filteredSentences.length > 0) return filteredSentences;
  return allSentences;
}

export function pickUniqueRandomRows<T extends { id: string }>(
  pool: T[],
  count: number
): T[] {
  return shuffle(pool).slice(0, Math.min(count, pool.length));
}
