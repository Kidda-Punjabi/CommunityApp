export type HomeworkQuestion = {
  id: string;
  questionNumber: number;
  promptEnglish: string;
  answerGurmukhi: string | null;
  answerRomanised: string | null;
};

export type HomeworkQuestionAid = {
  lookSayGurmukhi: string | null;
  lookSayRomanised: string | null;
  exampleGuidance: string | null;
};

const OPEN_RESPONSE_RE = /^\(?\s*open response/i;
const GURMUKHI_RUN_RE = /[\u0A00-\u0A7F]+(?:\s+[\u0A00-\u0A7F]+)*/g;

export function isOpenResponseGuidance(romanised: string | null | undefined): boolean {
  return Boolean(romanised && OPEN_RESPONSE_RE.test(romanised.trim()));
}

export function openResponseExampleText(romanised: string): string {
  const trimmed = romanised.trim().replace(/^\(/, "").replace(/\)$/, "").trim();
  const example = trimmed.match(/e\.g\.\s*(.+)$/i);
  if (example?.[1]) return example[1].trim();
  return trimmed.replace(/^open response\s*[—–-]\s*/i, "").trim();
}

export function extractGurmukhiFromPrompt(prompt: string): string | null {
  const matches = prompt.match(GURMUKHI_RUN_RE);
  if (!matches?.length) return null;
  return matches.join(" ").replace(/\s+/g, " ").trim() || null;
}

/**
 * Student-facing aids only — never surface hidden answer keys.
 * Gurmukhi already in the prompt is a look/say cue. Open-response romanised
 * is example guidance. Translation keys (Beginners English prompts) stay hidden.
 */
export function homeworkQuestionAid(question: HomeworkQuestion): HomeworkQuestionAid {
  const romanised = question.answerRomanised?.trim() || null;
  const answerGurmukhi = question.answerGurmukhi?.trim() || null;
  const extracted = extractGurmukhiFromPrompt(question.promptEnglish);

  const exampleGuidance = isOpenResponseGuidance(romanised)
    ? openResponseExampleText(romanised!)
    : null;

  if (!extracted) {
    return { lookSayGurmukhi: null, lookSayRomanised: null, exampleGuidance };
  }

  const compactExtracted = extracted.replace(/\s+/g, "");
  const compactAnswer = answerGurmukhi?.replace(/\s+/g, "") ?? "";
  const showPronunciation =
    !exampleGuidance &&
    Boolean(compactAnswer) &&
    compactExtracted.includes(compactAnswer);

  return {
    lookSayGurmukhi: extracted,
    lookSayRomanised: showPronunciation ? romanised : null,
    exampleGuidance,
  };
}
