import type { LiveTranslateDirection, LiveTranslateSide } from "@/lib/live-translate/config";

const GURMUKHI = /[\u0A00-\u0A7F]/;

function isEnglishLanguageCode(code: string): boolean {
  const normalized = code.toLowerCase();
  return normalized === "en" || normalized === "eng" || normalized.startsWith("en-");
}

function isPunjabiLanguageCode(code: string): boolean {
  const normalized = code.toLowerCase();
  return normalized === "pa" || normalized === "pan" || normalized === "pun" || normalized.startsWith("pa-");
}

export function directionFromLanguageCode(
  languageCode: string | null | undefined
): LiveTranslateDirection | null {
  if (!languageCode?.trim()) return null;
  if (isEnglishLanguageCode(languageCode)) return "en-to-pa";
  if (isPunjabiLanguageCode(languageCode)) return "pa-to-en";
  return null;
}

export function directionFromActiveSide(side: LiveTranslateSide): LiveTranslateDirection {
  return side === "member" ? "en-to-pa" : "pa-to-en";
}

export function directionFromTranscriptText(text: string): LiveTranslateDirection | null {
  if (GURMUKHI.test(text)) return "pa-to-en";
  if (/[a-z]/i.test(text)) return "en-to-pa";
  return null;
}

export type TranslationDirectionSource = "language_code" | "transcript" | "active_side";

export function resolveTranslationDirection(options: {
  languageCode: string | null;
  activeSide: LiveTranslateSide;
  transcript: string;
}): LiveTranslateDirection {
  return resolveTranslationDirectionWithSource(options).direction;
}

export function resolveTranslationDirectionWithSource(options: {
  languageCode: string | null;
  activeSide: LiveTranslateSide;
  transcript: string;
}): { direction: LiveTranslateDirection; source: TranslationDirectionSource } {
  const fromCode = directionFromLanguageCode(options.languageCode);
  if (fromCode) {
    return { direction: fromCode, source: "language_code" };
  }
  const fromText = directionFromTranscriptText(options.transcript);
  if (fromText) {
    return { direction: fromText, source: "transcript" };
  }
  return {
    direction: directionFromActiveSide(options.activeSide),
    source: "active_side",
  };
}

export function displaySideForDirection(direction: LiveTranslateDirection): LiveTranslateSide {
  return direction === "en-to-pa" ? "member" : "other";
}
