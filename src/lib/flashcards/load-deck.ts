import { canUserAccessLesson } from "@/lib/membership/lesson-access";
import {
  computeDeckConfidenceStats,
  fetchFlashcardProgressMap,
  type FlashcardProgressRow,
} from "@/lib/progress/flashcard-progress";
import { fetchMatchScore } from "@/lib/progress/match-scores";
import { LESSON_SCOPED_DECK_ID } from "@/lib/learning/match-lesson-content";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FlashcardDeckCard, FlashcardDeckContext } from "./types";
import { resolveDeckName } from "./utils";

const CARD_SELECT =
  "id, front_text, back_text, romanised, deck_id, deck_name, icon_name, flashcard_sets(name)";

type CardRow = FlashcardDeckCard & {
  flashcard_sets: { name: string } | { name: string }[] | null;
};

type LessonAccess =
  | { kind: "not_found" }
  | { kind: "forbidden"; requiredCourseLabel?: string }
  | { kind: "ok"; lesson: NonNullable<Awaited<ReturnType<typeof canUserAccessLesson>>["lesson"]> };

function normalizeCards(rows: CardRow[] | null): FlashcardDeckCard[] {
  return (rows ?? []).map((row) => {
    const { flashcard_sets: _set, ...card } = row;
    return {
      ...card,
      romanised: card.romanised?.trim() || null,
    };
  });
}

function setNameFromRow(row: CardRow | undefined): string | null {
  if (!row?.flashcard_sets) return null;
  const set = Array.isArray(row.flashcard_sets)
    ? row.flashcard_sets[0]
    : row.flashcard_sets;
  return set?.name ?? null;
}

async function resolveLessonAccess(
  supabase: SupabaseClient,
  userId: string,
  lessonId: string
): Promise<LessonAccess> {
  const access = await canUserAccessLesson(supabase, userId, lessonId);

  if (!access.lesson) {
    return { kind: "not_found" };
  }

  if (!access.allowed) {
    return {
      kind: "forbidden",
      requiredCourseLabel: access.requiredCourseLabel,
    };
  }

  return { kind: "ok", lesson: access.lesson };
}

async function getLinkedDeckIds(
  supabase: SupabaseClient,
  lessonId: string
): Promise<string[]> {
  const { data: links } = await supabase
    .from("set_course_links")
    .select("deck_id")
    .eq("lesson_id", lessonId);

  const linked = [...new Set((links ?? []).map((link) => link.deck_id))];
  if (linked.length > 0) return linked;

  const { data: legacyCards } = await supabase
    .from("flashcards")
    .select("deck_id")
    .eq("lesson_id", lessonId);

  const deckIds = [
    ...new Set(
      (legacyCards ?? [])
        .map((card) => card.deck_id)
        .filter((deckId): deckId is string => Boolean(deckId))
    ),
  ];

  const hasLessonScoped = (legacyCards ?? []).some((card) => !card.deck_id);
  if (hasLessonScoped) {
    deckIds.push(LESSON_SCOPED_DECK_ID);
  }

  return deckIds;
}

async function loadCardsForDeck(
  supabase: SupabaseClient,
  lessonId: string,
  deckId: string,
  linkedDeckIds: string[]
): Promise<CardRow[]> {
  if (deckId === LESSON_SCOPED_DECK_ID) {
    const { data } = await supabase
      .from("flashcards")
      .select(CARD_SELECT)
      .eq("lesson_id", lessonId)
      .is("deck_id", null)
      .order("created_at");
    return (data as CardRow[] | null) ?? [];
  }

  const deckLinked = linkedDeckIds.includes(deckId);

  if (deckLinked) {
    const { data } = await supabase
      .from("flashcards")
      .select(CARD_SELECT)
      .eq("deck_id", deckId)
      .order("created_at");
    return (data as CardRow[] | null) ?? [];
  }

  const { data } = await supabase
    .from("flashcards")
    .select(CARD_SELECT)
    .eq("deck_id", deckId)
    .eq("lesson_id", lessonId)
    .order("created_at");
  return (data as CardRow[] | null) ?? [];
}

function buildDeckContext(
  lesson: NonNullable<Awaited<ReturnType<typeof canUserAccessLesson>>["lesson"]>,
  deckId: string,
  cardRows: CardRow[]
): FlashcardDeckContext {
  const cards = normalizeCards(cardRows);
  const deckName = resolveDeckName(cards, setNameFromRow(cardRows[0]));
  const course = Array.isArray(lesson.courses) ? lesson.courses[0] : lesson.courses;

  return {
    lessonId: lesson.id,
    lessonTitle: lesson.title ?? "Lesson",
    courseName: course?.name ?? "Course",
    lessonNumber: lesson.lesson_number ?? 0,
    deckId,
    deckName,
    cards,
  };
}

export type FlashcardSetSummary = {
  deckId: string;
  deckName: string;
  cards: FlashcardDeckCard[];
  stats: ReturnType<typeof computeDeckConfidenceStats>;
  matchScore: Awaited<ReturnType<typeof fetchMatchScore>>;
};

export async function loadFlashcardSetsForLesson(
  supabase: SupabaseClient,
  userId: string,
  lessonId: string
) {
  const access = await resolveLessonAccess(supabase, userId, lessonId);
  if (access.kind !== "ok") return access;

  const linkedDeckIds = await getLinkedDeckIds(supabase, lessonId);
  if (linkedDeckIds.length === 0) {
    return { kind: "empty" as const, lesson: access.lesson };
  }

  const sets: FlashcardSetSummary[] = [];

  for (const deckId of linkedDeckIds) {
    const cardRows = await loadCardsForDeck(
      supabase,
      lessonId,
      deckId,
      linkedDeckIds
    );
    if (!cardRows.length) continue;

    const cards = normalizeCards(cardRows);
    const deckName = resolveDeckName(cards, setNameFromRow(cardRows[0]));
    const progressMap = await fetchFlashcardProgressMap(
      supabase,
      userId,
      cards.map((card) => card.id)
    );
    const stats = computeDeckConfidenceStats(
      cards.map((card) => card.id),
      progressMap
    );
    const matchScore = await fetchMatchScore(supabase, userId, deckName);

    sets.push({ deckId, deckName, cards, stats, matchScore });
  }

  if (sets.length === 0) {
    return { kind: "empty" as const, lesson: access.lesson };
  }

  sets.sort((a, b) => a.deckName.localeCompare(b.deckName));

  return {
    kind: "ok" as const,
    lesson: access.lesson,
    sets,
  };
}

export async function loadFlashcardDeck(
  supabase: SupabaseClient,
  userId: string,
  lessonId: string,
  deckId: string
) {
  const access = await resolveLessonAccess(supabase, userId, lessonId);
  if (access.kind !== "ok") return access;

  const linkedDeckIds = await getLinkedDeckIds(supabase, lessonId);
  if (!linkedDeckIds.includes(deckId)) {
    return { kind: "not_found" as const };
  }

  const cardRows = await loadCardsForDeck(
    supabase,
    lessonId,
    deckId,
    linkedDeckIds
  );

  if (!cardRows.length) {
    return { kind: "empty" as const, lesson: access.lesson };
  }

  const deck = buildDeckContext(access.lesson, deckId, cardRows);

  const [progressMap, matchScore] = await Promise.all([
    fetchFlashcardProgressMap(
      supabase,
      userId,
      deck.cards.map((card) => card.id)
    ),
    fetchMatchScore(supabase, userId, deck.deckName),
  ]);

  const progress: FlashcardProgressRow[] = [...progressMap.values()];

  return {
    kind: "ok" as const,
    deck,
    progress,
    matchScore,
  };
}
