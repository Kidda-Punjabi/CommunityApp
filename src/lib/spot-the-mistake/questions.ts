import {
  buildGrammarTileLexicon,
  parseDistractorConjugations,
} from "@/lib/games/grammar-sentence";
import { pickCycledPool } from "@/lib/games/session-settings";
import type { DistractorConjugation, GenderedNoun, GrammarSentence } from "@/lib/games/types";
import {
  logSuspiciousDistractorsForReview,
  usableDistractorConjugations,
} from "./distractors";
import {
  buildFixOptions,
  buildGlobalObjectOptionPool,
  buildGlobalVerbOptionPool,
} from "./fix-options";
import {
  objectMistakeCandidates,
  toMistakeWord,
  type ObjectNounRef,
  type SpotMistakeKind,
} from "./mistake-slots";
import {
  buildBrokenRomanisedLine,
  buildCorrectedRomanisedLine,
  tokenizeBrokenSentence,
  tokenizeCorrectedSentence,
} from "./tokens";
import type { SpotTheMistakeQuestion } from "./types";
import { replaceTokenInSentence } from "./verb-location";

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function canBuildVerbMistake(sentence: GrammarSentence): boolean {
  if (!sentence.target_verb_gurmukhi?.trim()) return false;
  return usableDistractorConjugations(sentence).length > 0;
}

function canBuildObjectMistake(
  sentence: GrammarSentence,
  genderedNounWords: Set<string>
): boolean {
  if (sentence.word_tiles.length === 0) return false;
  return (
    objectMistakeCandidates(
      sentence.word_tiles,
      sentence.target_verb_gurmukhi,
      sentence.target_verb_root_gurmukhi,
      genderedNounWords
    ).length > 0
  );
}

function pickMistakeKind(
  sentence: GrammarSentence,
  genderedNounWords: Set<string>
): SpotMistakeKind | null {
  const verbOk = canBuildVerbMistake(sentence);
  const objectOk = canBuildObjectMistake(sentence, genderedNounWords);

  if (verbOk && objectOk) {
    return Math.random() < 0.5 ? "verb" : "object";
  }
  if (verbOk) return "verb";
  if (objectOk) return "object";
  return null;
}

function buildVerbMistake(sentence: GrammarSentence) {
  const usable = usableDistractorConjugations(sentence);
  if (usable.length === 0) return null;

  const mistake = pickRandom(usable);
  const slotGurmukhi = sentence.target_verb_gurmukhi!.trim();

  return {
    slotGurmukhi,
    correctWord: toMistakeWord(slotGurmukhi, sentence.target_verb_romanised?.trim() ?? ""),
    mistakeWord: toMistakeWord(mistake.gurmukhi, mistake.romanised),
  };
}

function buildObjectMistake(sentence: GrammarSentence, genderedNouns: ObjectNounRef[]) {
  const nounWords = new Set(genderedNouns.map((noun) => noun.punjabi_word.trim()));
  const candidates = objectMistakeCandidates(
    sentence.word_tiles,
    sentence.target_verb_gurmukhi,
    sentence.target_verb_root_gurmukhi,
    nounWords
  );
  if (candidates.length === 0) return null;

  const slot = pickRandom(candidates);
  const distractorNouns = genderedNouns.filter(
    (noun) => noun.punjabi_word.trim() !== slot.gurmukhi.trim()
  );
  if (distractorNouns.length === 0) return null;

  const mistakeNoun = pickRandom(distractorNouns);

  return {
    slotGurmukhi: slot.gurmukhi.trim(),
    correctWord: toMistakeWord(
      slot.gurmukhi,
      slot.romanised.trim() || mistakeNoun.romanised?.trim() || ""
    ),
    mistakeWord: toMistakeWord(mistakeNoun.punjabi_word, mistakeNoun.romanised?.trim() ?? ""),
  };
}

export function buildSpotTheMistakeQuestion(
  sentence: GrammarSentence,
  lexicon: Map<string, string>,
  genderedNouns: ObjectNounRef[],
  globalVerbPool: ReturnType<typeof buildGlobalVerbOptionPool>,
  globalObjectPool: ReturnType<typeof buildGlobalObjectOptionPool>,
  index: number
): SpotTheMistakeQuestion | null {
  const nounWords = new Set(genderedNouns.map((noun) => noun.punjabi_word.trim()));
  const mistakeKind = pickMistakeKind(sentence, nounWords);
  if (!mistakeKind) return null;

  const mistakeBundle =
    mistakeKind === "verb"
      ? buildVerbMistake(sentence)
      : buildObjectMistake(sentence, genderedNouns);
  if (!mistakeBundle) return null;

  const { slotGurmukhi, correctWord, mistakeWord } = mistakeBundle;

  const brokenPunjabi = replaceTokenInSentence(
    sentence.punjabi_sentence,
    slotGurmukhi,
    mistakeWord.gurmukhi
  );
  if (!brokenPunjabi) return null;

  const tokens = tokenizeBrokenSentence(sentence, slotGurmukhi, mistakeWord, lexicon);
  if (tokens.length === 0) return null;

  const sentenceSpecific: DistractorConjugation[] =
    mistakeKind === "verb"
      ? usableDistractorConjugations(sentence)
      : genderedNouns
          .filter(
            (noun) =>
              noun.punjabi_word.trim() !== correctWord.gurmukhi &&
              noun.punjabi_word.trim() !== mistakeWord.gurmukhi
          )
          .map((noun) => ({
            gurmukhi: noun.punjabi_word,
            romanised: noun.romanised?.trim() ?? "",
          }));

  const globalPool = mistakeKind === "verb" ? globalVerbPool : globalObjectPool;

  const { options, correctOptionId } = buildFixOptions(
    correctWord,
    mistakeWord,
    sentenceSpecific,
    globalPool
  );

  return {
    id: `${sentence.id}-${index}`,
    grammarSentenceId: sentence.id,
    mistakeKind,
    slotGurmukhi,
    correctWord,
    mistakeWord,
    brokenPunjabi,
    brokenRomanised: buildBrokenRomanisedLine(sentence, slotGurmukhi, mistakeWord, lexicon),
    correctedPunjabi: sentence.punjabi_sentence,
    correctedRomanised: buildCorrectedRomanisedLine(sentence, lexicon),
    englishTranslation: sentence.english_translation,
    tokens,
    correctedTokens: tokenizeCorrectedSentence(sentence, slotGurmukhi, lexicon),
    fixOptions: options,
    correctFixOptionId: correctOptionId,
  };
}

export function filterSpotTheMistakeEligible(
  sentences: GrammarSentence[],
  genderedNouns: ObjectNounRef[]
): GrammarSentence[] {
  const nounWords = new Set(genderedNouns.map((noun) => noun.punjabi_word.trim()));
  return sentences.filter(
    (sentence) =>
      canBuildVerbMistake(sentence) || canBuildObjectMistake(sentence, nounWords)
  );
}

export function buildSpotTheMistakeRound(
  allSentences: GrammarSentence[],
  genderedNouns: GenderedNoun[],
  questionCount: number
): { questions: SpotTheMistakeQuestion[]; poolSize: number } {
  const nounRefs: ObjectNounRef[] = genderedNouns.map((noun) => ({
    punjabi_word: noun.punjabi_word,
    romanised: noun.romanised,
  }));

  const eligible = filterSpotTheMistakeEligible(allSentences, nounRefs);
  logSuspiciousDistractorsForReview(eligible);

  const lexicon = buildGrammarTileLexicon(allSentences);
  const globalVerbPool = buildGlobalVerbOptionPool(allSentences);
  const globalObjectPool = buildGlobalObjectOptionPool(nounRefs);
  const picked = pickCycledPool(eligible, questionCount);

  const questions: SpotTheMistakeQuestion[] = [];
  picked.forEach((sentence, index) => {
    const question = buildSpotTheMistakeQuestion(
      sentence,
      lexicon,
      nounRefs,
      globalVerbPool,
      globalObjectPool,
      index
    );
    if (question) questions.push(question);
  });

  return { questions, poolSize: eligible.length };
}

/** Confirmed shape: distractor_conjugations entries use { gurmukhi, romanised }. */
export function assertDistractorShapeSample(sentences: GrammarSentence[]): void {
  const sample = sentences.find((sentence) => sentence.distractor_conjugations.length > 0);
  if (!sample) return;

  const parsed = parseDistractorConjugations(sample.distractor_conjugations);
  if (parsed.length === 0) {
    console.warn("[Spot the Mistake] distractor_conjugations present but none parsed — check keys");
  }
}

export function isSpotTheMistakeEligibleForPool(
  sentences: GrammarSentence[],
  genderedNouns: GenderedNoun[]
): boolean {
  const nounRefs: ObjectNounRef[] = genderedNouns.map((noun) => ({
    punjabi_word: noun.punjabi_word,
    romanised: noun.romanised,
  }));
  return filterSpotTheMistakeEligible(sentences, nounRefs).length > 0;
}
