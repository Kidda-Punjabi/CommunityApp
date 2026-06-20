export const MASTER_VOCABULARY_DECK_NAME = "Vocabulary - Master List";

export type DictionaryEntry = {
  id: string;
  english: string;
  punjabi: string;
  romanised: string | null;
  gender: "masculine" | "feminine" | null;
  isPlural: boolean;
};

type FlashcardRow = {
  id: string;
  front_text: string;
  back_text: string;
  romanised?: string | null;
  topic_tags?: string[] | null;
};

export function normalizeMasterDeckName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isMasterVocabularyDeck(name: string): boolean {
  const normalized = normalizeMasterDeckName(name);
  return (
    normalized === normalizeMasterDeckName(MASTER_VOCABULARY_DECK_NAME) ||
    (normalized.includes("vocabulary") && normalized.includes("master list"))
  );
}

export function parseDictionaryMetadata(topicTags: string[] | null | undefined): {
  gender: "masculine" | "feminine" | null;
  isPlural: boolean;
} {
  const tags = (topicTags ?? []).map((tag) => tag.trim().toLowerCase());

  let gender: "masculine" | "feminine" | null = null;
  if (tags.some((tag) => tag === "gender_masculine" || tag === "masculine")) {
    gender = "masculine";
  } else if (tags.some((tag) => tag === "gender_feminine" || tag === "feminine")) {
    gender = "feminine";
  }

  const isPlural = tags.some((tag) => tag === "plural");

  return { gender, isPlural };
}

export function mapFlashcardToDictionaryEntry(row: FlashcardRow): DictionaryEntry {
  const { gender, isPlural } = parseDictionaryMetadata(row.topic_tags);

  return {
    id: row.id,
    english: row.front_text.trim(),
    punjabi: row.back_text.trim(),
    romanised: row.romanised?.trim() || null,
    gender,
    isPlural,
  };
}

function isMalformedEnglishGloss(english: string): boolean {
  const text = english.trim();
  if (!text) return true;
  if (/^[A-Z][a-z]+(?:karna|karnaa)$/i.test(text)) return true;
  if (/^[a-z]+(?:karna|karnaa)$/i.test(text) && !text.includes(" ")) return true;
  return false;
}

/** Keep one entry per Punjabi word; drop obvious import artifacts. */
export function dedupeDictionaryEntries(entries: DictionaryEntry[]): DictionaryEntry[] {
  const byPunjabi = new Map<string, DictionaryEntry>();

  for (const entry of entries) {
    if (isMalformedEnglishGloss(entry.english)) continue;

    const key = entry.punjabi.trim();
    if (!key) continue;

    const existing = byPunjabi.get(key);
    if (!existing) {
      byPunjabi.set(key, entry);
      continue;
    }

    const entryIsVerb = entry.english.toLowerCase().startsWith("to ");
    const existingIsVerb = existing.english.toLowerCase().startsWith("to ");
    if (entryIsVerb && !existingIsVerb) {
      byPunjabi.set(key, entry);
    }
  }

  return [...byPunjabi.values()].sort((a, b) => a.english.localeCompare(b.english));
}

export function searchDictionaryEntries(
  entries: DictionaryEntry[],
  query: string
): DictionaryEntry[] {
  const term = query.trim().toLowerCase();
  if (!term) return [];

  return entries.filter((entry) => {
    if (entry.english.toLowerCase().includes(term)) return true;
    if (entry.punjabi.toLowerCase().includes(term)) return true;
    if (entry.romanised?.toLowerCase().includes(term)) return true;
    return false;
  });
}
