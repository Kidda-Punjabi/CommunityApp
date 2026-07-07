export const MASTER_VOCABULARY_DECK_NAME = "Vocabulary - Master List";

const DICTIONARY_META_TOPIC_TAGS = new Set([
  "gender_masculine",
  "gender_feminine",
  "masculine",
  "feminine",
  "plural",
]);

export type DictionaryEntry = {
  id: string;
  english: string;
  punjabi: string;
  romanised: string | null;
  gender: "masculine" | "feminine" | null;
  isPlural: boolean;
  topicTags: string[];
  exampleGurmukhi: string | null;
  exampleRomanised: string | null;
  exampleEnglish: string | null;
  /** Approved word pronunciation only — never pending clips */
  wordAudioUrl: string | null;
  /** Approved example sentence audio only */
  exampleAudioUrl: string | null;
};

type FlashcardRow = {
  id: string;
  front_text: string;
  back_text: string;
  romanised?: string | null;
  topic_tags?: string[] | null;
  example_sentence_gurmukhi?: string | null;
  example_sentence_romanised?: string | null;
  example_sentence_english?: string | null;
};

export type DictionaryAudioLookup = {
  wordAudioUrl: string | null;
  exampleAudioUrl: string | null;
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

export function contentTopicTags(topicTags: string[] | null | undefined): string[] {
  return (topicTags ?? [])
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0 && !DICTIONARY_META_TOPIC_TAGS.has(tag));
}

export function mapFlashcardToDictionaryEntry(
  row: FlashcardRow,
  audio?: DictionaryAudioLookup
): DictionaryEntry {
  const { gender, isPlural } = parseDictionaryMetadata(row.topic_tags);

  return {
    id: row.id,
    english: row.front_text.trim(),
    punjabi: row.back_text.trim(),
    romanised: row.romanised?.trim() || null,
    gender,
    isPlural,
    topicTags: contentTopicTags(row.topic_tags),
    exampleGurmukhi: row.example_sentence_gurmukhi?.trim() || null,
    exampleRomanised: row.example_sentence_romanised?.trim() || null,
    exampleEnglish: row.example_sentence_english?.trim() || null,
    wordAudioUrl: audio?.wordAudioUrl ?? null,
    exampleAudioUrl: audio?.exampleAudioUrl ?? null,
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

  function scoreWordField(value: string | null | undefined): number {
    if (!value) return 0;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return 0;
    if (normalized === term) return 500;
    if (normalized.startsWith(term)) return 300;
    if (normalized.includes(term)) return 100;
    return 0;
  }

  function scoreExampleField(value: string | null | undefined): number {
    if (!value) return 0;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return 0;
    if (normalized.includes(term)) return 20;
    return 0;
  }

  const scored = entries
    .map((entry) => {
      const wordScore = Math.max(
        scoreWordField(entry.english),
        scoreWordField(entry.punjabi),
        scoreWordField(entry.romanised)
      );
      const exampleScore = Math.max(
        scoreExampleField(entry.exampleEnglish),
        scoreExampleField(entry.exampleRomanised),
        scoreExampleField(entry.exampleGurmukhi)
      );

      return { entry, wordScore, exampleScore };
    })
    .filter((row) => row.wordScore > 0 || row.exampleScore > 0);

  const hasWordMatches = scored.some((row) => row.wordScore > 0);
  const filtered = hasWordMatches ? scored.filter((row) => row.wordScore > 0) : scored;

  return filtered
    .sort((a, b) => {
      if (b.wordScore !== a.wordScore) return b.wordScore - a.wordScore;
      if (b.exampleScore !== a.exampleScore) return b.exampleScore - a.exampleScore;
      return a.entry.english.localeCompare(b.entry.english);
    })
    .map((row) => row.entry);
}

function sharedTopicTagCount(a: DictionaryEntry, b: DictionaryEntry): number {
  const bTags = new Set(contentTopicTags(b.topicTags));
  return contentTopicTags(a.topicTags).filter((tag) => bTags.has(tag)).length;
}

/** Related entries by shared topic tags, with a light alphabetical fallback. */
export function findRelatedDictionaryEntries(
  entry: DictionaryEntry,
  entries: DictionaryEntry[],
  limit = 10
): DictionaryEntry[] {
  const others = entries.filter((candidate) => candidate.id !== entry.id);
  const entryTags = contentTopicTags(entry.topicTags);

  if (entryTags.length > 0) {
    return others
      .filter((candidate) => sharedTopicTagCount(entry, candidate) > 0)
      .sort((a, b) => {
        const tagDiff = sharedTopicTagCount(entry, b) - sharedTopicTagCount(entry, a);
        if (tagDiff !== 0) return tagDiff;
        return a.english.localeCompare(b.english);
      })
      .slice(0, limit);
  }

  const firstLetter = entry.english.trim().charAt(0).toLowerCase();
  if (!firstLetter) return [];

  return others
    .filter((candidate) => candidate.english.trim().charAt(0).toLowerCase() === firstLetter)
    .sort((a, b) => a.english.localeCompare(b.english))
    .slice(0, limit);
}

export type DictionaryExploreCategory = {
  id: string;
  label: string;
  description: string;
  icon:
    | "utensils"
    | "users"
    | "paw-print"
    | "heart-pulse"
    | "home"
    | "car"
    | "cloud-sun"
    | "graduation-cap";
  matchTags: string[];
};

/** Curated browse topics — each maps to one or more flashcard topic_tags. */
export const DICTIONARY_EXPLORE_CATEGORIES: DictionaryExploreCategory[] = [
  {
    id: "food",
    label: "Food & drink",
    description: "Meals, ingredients, and kitchen words",
    icon: "utensils",
    matchTags: ["food", "drinks", "cooking"],
  },
  {
    id: "family",
    label: "Family",
    description: "Relatives and people close to you",
    icon: "users",
    matchTags: ["family"],
  },
  {
    id: "animals",
    label: "Animals",
    description: "Pets, wildlife, and creatures",
    icon: "paw-print",
    matchTags: ["animals"],
  },
  {
    id: "body",
    label: "Body & health",
    description: "Parts of the body and wellbeing",
    icon: "heart-pulse",
    matchTags: ["body", "body_health", "health"],
  },
  {
    id: "home",
    label: "Around the home",
    description: "Household items, furniture, and clothing",
    icon: "home",
    matchTags: ["household", "furniture", "clothing", "home"],
  },
  {
    id: "travel",
    label: "Places & travel",
    description: "Getting around and where you go",
    icon: "car",
    matchTags: ["transport", "places", "travel"],
  },
  {
    id: "nature",
    label: "Nature & weather",
    description: "Outdoors, seasons, colours, and feelings",
    icon: "cloud-sun",
    matchTags: ["nature", "weather", "colours", "colors", "emotions"],
  },
  {
    id: "school",
    label: "School & everyday",
    description: "Classroom, jobs, numbers, and daily life",
    icon: "graduation-cap",
    matchTags: ["school", "professions", "technology", "numbers", "money", "calendar", "time"],
  },
];

function normalizedTagSet(tags: string[]): Set<string> {
  return new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean));
}

export function entryMatchesExploreCategory(
  entry: DictionaryEntry,
  category: DictionaryExploreCategory
): boolean {
  const entryTags = normalizedTagSet(contentTopicTags(entry.topicTags));
  const matchTags = normalizedTagSet(category.matchTags);
  for (const tag of matchTags) {
    if (entryTags.has(tag)) return true;
  }
  return false;
}

export function filterDictionaryByExploreCategory(
  entries: DictionaryEntry[],
  categoryId: string
): DictionaryEntry[] {
  const category = DICTIONARY_EXPLORE_CATEGORIES.find((item) => item.id === categoryId);
  if (!category) return [];

  return entries
    .filter((entry) => entryMatchesExploreCategory(entry, category))
    .sort((a, b) => a.english.localeCompare(b.english));
}

export function countDictionaryExploreCategories(
  entries: DictionaryEntry[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const category of DICTIONARY_EXPLORE_CATEGORIES) {
    counts[category.id] = entries.filter((entry) =>
      entryMatchesExploreCategory(entry, category)
    ).length;
  }
  return counts;
}
