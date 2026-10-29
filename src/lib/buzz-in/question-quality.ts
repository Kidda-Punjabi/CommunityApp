/**
 * Buzz-in question quality: which cards can be asked, how they are shown, and which
 * wrong answers sit beside them. Pure functions so they can be unit tested.
 *
 * Rules:
 * - A card must have Punjabi (Gurmukhi) in its answer and a romanisation, so beginners
 *   can always read every option. Grammar formula cards ("Subject + Object + ...") drop out.
 * - "36" style cards whose answer starts with Gurmukhi digits ("੩੬ — ਛੱਤੀ") show the word only.
 * - Wrong answers are the same kind as the right one (word / sentence / number), prefer the
 *   same word type (verb with verbs), and for sentences prefer the closest sentences.
 * - The same question never appears twice in one game.
 */
import { containsGurmukhi, latinRomanised } from "@/lib/conjugation/romanised";
import { shuffleArray } from "@/lib/flashcards/utils";
import { splitBilingual } from "@/lib/group-games/split-bilingual";
import type { McqQuestionKind, McqQuestionPayload } from "@/lib/group-games/buzz-race-types";

export type BuzzInSourceCard = {
  id: string;
  front_text: string | null;
  back_text: string | null;
  romanised?: string | null;
  topic_tags?: string[] | null;
};

export type BuzzInCard = {
  id: string;
  prompt: string;
  /** Gurmukhi answer exactly as shown on the option. */
  answer: string;
  romanised: string;
  kind: McqQuestionKind;
  wordTypes: string[];
  tags: string[];
  /** Normalised English prompt, used so a question is never asked twice. */
  key: string;
};

/** Tags that describe what kind of word a card is (used to match wrong answers). */
const WORD_TYPE_TAGS = new Set([
  "verb",
  "verbs",
  "verbal",
  "verbal_noun",
  "noun",
  "adjective",
  "adjectives",
  "adverb",
  "number",
  "numbers",
  "ordinal",
  "pronoun",
  "question_word",
  "connector",
  "connectors",
  "postposition",
  "position",
  "imperative",
  "phrase",
]);

const NUMERAL_PREFIX = /^[੦-੯0-9]+\s*[—–-]\s*/;

function normalizeTags(tags: string[] | null | undefined): string[] {
  return (tags ?? []).map((tag) => String(tag).trim().toLowerCase()).filter(Boolean);
}

function gurmukhiWords(text: string): string[] {
  return text
    .normalize("NFC")
    .split(/\s+/)
    .map((word) => word.replace(/[^਀-੿]/g, ""))
    .filter(Boolean);
}

export function classifyKind(prompt: string, answer: string): McqQuestionKind {
  if (/^\d[\d,.\s]*$/.test(prompt.trim())) return "number";
  return gurmukhiWords(answer).length >= 3 ? "sentence" : "word";
}

/** Turn a flashcard into a Buzz-in card, or null when it can't be asked fairly. */
export function toBuzzInCard(row: BuzzInSourceCard): BuzzInCard | null {
  const prompt = row.front_text?.trim() ?? "";
  const rawBack = row.back_text?.trim() ?? "";
  if (!prompt || !rawBack) return null;

  const { main, bracketLatin } = splitBilingual(rawBack);
  const answer = main.replace(NUMERAL_PREFIX, "").trim();
  if (!answer || !containsGurmukhi(answer)) return null;
  // Answer must be Punjabi only: no English formula text mixed in.
  if (/[A-Za-z]/.test(answer)) return null;
  // Conversion drills ("ਲਿਖਣਾ → ਲਿਖੋ") aren't translations.
  if (/[→=+]/.test(answer) || /[→=+]/.test(prompt)) return null;
  if (containsGurmukhi(prompt)) return null;

  const romanised = latinRomanised(row.romanised) ?? bracketLatin;
  if (!romanised) return null;

  const tags = normalizeTags(row.topic_tags);
  const kind = classifyKind(prompt, answer);
  return {
    id: row.id,
    prompt,
    answer,
    romanised,
    kind,
    wordTypes: tags.filter((tag) => WORD_TYPE_TAGS.has(tag)),
    tags,
    key: prompt.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim(),
  };
}

export function answerKey(text: string): string {
  return text.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
}

/** One card per question (English prompt), keeping the first seen. */
export function dedupeCards(cards: BuzzInCard[]): BuzzInCard[] {
  const seen = new Set<string>();
  const result: BuzzInCard[] = [];
  for (const card of cards) {
    if (seen.has(card.key)) continue;
    seen.add(card.key);
    result.push(card);
  }
  return result;
}

/** Count of distinct askable questions (what the picker shows). */
export function countDistinctQuestions(cards: BuzzInCard[]): number {
  return new Set(cards.map((card) => card.key)).size;
}

function sentenceSimilarity(a: string, b: string): number {
  const wordsA = new Set(gurmukhiWords(a));
  const wordsB = gurmukhiWords(b);
  let shared = 0;
  for (const word of wordsB) if (wordsA.has(word)) shared += 1;
  const lengthGap = Math.abs(wordsA.size - wordsB.length);
  return shared * 2 - lengthGap * 0.5;
}

/**
 * Pick 3 wrong answers for `card` from `pool`. Order of preference:
 * same kind + same word type (or close sentences), then same kind, then anything.
 */
export function pickDistractors(
  card: BuzzInCard,
  pool: BuzzInCard[],
  random: () => number = Math.random
): BuzzInCard[] {
  const rightKey = answerKey(card.answer);
  const promptKey = card.prompt.trim().toLowerCase();
  const usedAnswers = new Set<string>([rightKey]);

  const candidates: BuzzInCard[] = [];
  const seen = new Set<string>([rightKey]);
  for (const other of pool) {
    const key = answerKey(other.answer);
    if (seen.has(key)) continue;
    // Never offer a second correct meaning (same English prompt).
    if (other.prompt.trim().toLowerCase() === promptKey) continue;
    seen.add(key);
    candidates.push(other);
  }

  const sameKind = candidates.filter((other) => other.kind === card.kind);

  let preferred: BuzzInCard[];
  if (card.kind === "sentence") {
    // Closest sentences first, with a little shuffle among equally close ones.
    preferred = [...sameKind]
      .map((other) => ({
        other,
        score: sentenceSimilarity(card.answer, other.answer) + random() * 0.9,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((entry) => entry.other);
  } else {
    const typeSet = new Set(card.wordTypes);
    preferred =
      typeSet.size > 0
        ? sameKind.filter((other) => other.wordTypes.some((type) => typeSet.has(type)))
        : [];
  }

  const picked: BuzzInCard[] = [];
  const take = (list: BuzzInCard[]) => {
    for (const other of shuffleWith(list, random)) {
      if (picked.length >= 3) return;
      const key = answerKey(other.answer);
      if (usedAnswers.has(key)) continue;
      usedAnswers.add(key);
      picked.push(other);
    }
  };

  take(preferred);
  take(sameKind);
  take(candidates);
  return picked;
}

function shuffleWith<T>(items: T[], random: () => number): T[] {
  if (random === Math.random) return shuffleArray(items);
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildBuzzInPayload(
  card: BuzzInCard,
  distractorPool: BuzzInCard[],
  random: () => number = Math.random
): McqQuestionPayload {
  const wrong = pickDistractors(card, distractorPool, random);
  const options = shuffleWith([card, ...wrong], random);
  return {
    flashcard_id: card.id,
    prompt: card.prompt,
    prompt_romanised: null,
    correct_answer: card.answer,
    options: options.map((option) => option.answer),
    options_romanised: options.map((option) => option.romanised),
    kind: card.kind,
  };
}

/** True when `pool` alone can give `card` three wrong answers of the same kind. */
export function hasEnoughSameKind(card: BuzzInCard, pool: BuzzInCard[]): boolean {
  const rightKey = answerKey(card.answer);
  const promptKey = card.prompt.trim().toLowerCase();
  const answers = new Set<string>();
  for (const other of pool) {
    if (other.kind !== card.kind) continue;
    if (other.prompt.trim().toLowerCase() === promptKey) continue;
    const key = answerKey(other.answer);
    if (key !== rightKey) answers.add(key);
    if (answers.size >= 3) return true;
  }
  return false;
}

/** Questions for a game: distinct, shuffled, with wrong answers from the topic when it can. */
export function buildBuzzInQuestionSet(
  topicCards: BuzzInCard[],
  allCards: BuzzInCard[],
  questionCount: number,
  random: () => number = Math.random
): McqQuestionPayload[] {
  const questions = shuffleWith(dedupeCards(topicCards), random).slice(0, questionCount);
  return questions.map((card) =>
    buildBuzzInPayload(card, hasEnoughSameKind(card, topicCards) ? topicCards : allCards, random)
  );
}
