import type { LiveTranslateDirection } from "@/lib/live-translate/config";

/** Spoken-language button / STT hint for a Live Translate clip. */
export type LiveTranslateSpokenLanguage = "en" | "pan";

export const LIVE_TRANSLATE_MIN_HOLD_MS = 600;
export const LIVE_TRANSLATE_MIN_BLOB_BYTES = 800;

const NON_SPEECH_TRANSCRIPT =
  /^[\s[\]()（）【】.…,!?！？\-–—*•_'"“”‘’]*?(?:\[(?:clicking|clicks?|music|silence|noise|inaudible|blank_audio|coughs?|laughter|applause|breathing|sighs?)\]|\((?:clicking|clicks?|music|silence|noise|inaudible|coughs?|laughter|applause|breathing|sighs?)\))[\s[\]()（）【】.…,!?！？\-–—*•_'"“”‘’]*$/i;

const ONLY_SYMBOLS = /^[\s[\]()（）【】.…,!?！？\-–—*•_'"“”‘’`~]+$/;

export function directionFromSpokenLanguage(
  language: LiveTranslateSpokenLanguage
): LiveTranslateDirection {
  return language === "en" ? "en-to-pa" : "pa-to-en";
}

export function sttLanguageCode(language: LiveTranslateSpokenLanguage): string {
  return language;
}

/** True when STT returned non-speech / junk that should not burn usage or show in chat. */
export function isNonSpeechTranscript(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (ONLY_SYMBOLS.test(trimmed)) return true;
  if (NON_SPEECH_TRANSCRIPT.test(trimmed)) return true;

  // Bracket-only audio event tags Scribe sometimes emits mid-string.
  const withoutTags = trimmed
    .replace(/\[[^\]]{0,40}\]/g, " ")
    .replace(/\([^)]{0,40}\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!withoutTags) return true;

  // Require at least a couple of letters (Latin or Gurmukhi).
  const letters = withoutTags.match(/[A-Za-z\u0A00-\u0A7F]/g) ?? [];
  return letters.length < 2;
}
