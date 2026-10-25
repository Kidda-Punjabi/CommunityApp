import { containsGurmukhi } from "@/lib/conjugation/romanised";

/**
 * Some flashcards store the answer as "ਬੁੱਧਵਾਰ (Budhvaar)". Split that into the
 * Gurmukhi and the Latin romanisation so the screen shows each once.
 */
export function splitBilingual(text: string | null | undefined): {
  main: string;
  bracketLatin: string | null;
} {
  const raw = (text ?? "").trim();
  const match = raw.match(/^(.*\S)\s*\(([^()]+)\)\s*$/);
  if (match && containsGurmukhi(match[1]) && !containsGurmukhi(match[2])) {
    return { main: match[1].trim(), bracketLatin: match[2].trim() };
  }
  return { main: raw, bracketLatin: null };
}

/** Key used to stop two versions of the same word appearing as separate options. */
export function bilingualKey(text: string | null | undefined): string {
  return splitBilingual(text).main.normalize("NFC").replace(/\s+/g, " ").toLowerCase();
}
