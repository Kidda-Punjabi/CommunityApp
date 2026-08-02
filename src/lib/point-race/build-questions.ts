import type { SupabaseClient } from "@supabase/supabase-js";
import { pickRandomItems } from "@/lib/flashcards/utils";
import {
  filterByContentFilters,
  topicFiltersFromSettings,
  type GroupGameContentFilters,
} from "@/lib/group-games/content-filters";
import {
  buildMcqPayload,
  normalizeFlashcardRow,
  type FlashcardForMcq,
} from "@/lib/group-games/build-mcq-question";
import type { McqQuestionPayload } from "@/lib/group-games/buzz-race-types";
import type { GameRoomSettings } from "@/lib/game-rooms/types";
import { loadScopedFlashcardPoolRows } from "@/lib/games/load-scoped-flashcards";
import { resolveGamesContentScope } from "@/lib/games/content-scope";

type FlashcardPoolCard = FlashcardForMcq & {
  difficulty: number | null;
  topic_tags: string[];
};

function filtersCacheKey(
  filters: GroupGameContentFilters,
  scopeMode: string,
  courseIds: string[]
): string {
  return JSON.stringify({
    topicTags: filters.topicTags,
    difficultyMin: filters.difficultyMin,
    difficultyMax: filters.difficultyMax,
    scopeMode,
    courseIds,
  });
}

const poolCache = new Map<string, FlashcardPoolCard[]>();

export async function loadFlashcardPool(
  supabase: SupabaseClient,
  settings?: GameRoomSettings | null
): Promise<FlashcardPoolCard[]> {
  const filters = topicFiltersFromSettings(settings);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const scope = await resolveGamesContentScope(supabase, user.id);
  const { rows, error } = await loadScopedFlashcardPoolRows<{
    id: string;
    front_text: string | null;
    back_text: string | null;
    romanised: string | null;
    category: string | null;
    difficulty: number | null;
    topic_tags: string[] | null;
    lesson_id: string | null;
  }>(
    supabase,
    user.id,
    "id, front_text, back_text, romanised, category, difficulty, topic_tags, lesson_id",
    { scope }
  );

  if (error) throw new Error(error);

  const cards = rows
    .map((row) => {
      const normalized = normalizeFlashcardRow(row);
      if (!normalized) return null;
      return {
        ...normalized,
        topic_tags: Array.isArray(row.topic_tags) ? row.topic_tags.map(String) : [],
      };
    })
    .filter((card): card is FlashcardPoolCard => card !== null);

  if (cards.length < 4) {
    throw new Error("Not enough flashcards to build point race questions (need at least 4).");
  }

  const { matched, usedFallback } = filterByContentFilters(
    cards,
    filters,
    (card) => card.topic_tags,
    (card) => card.difficulty
  );

  const pool = matched.length >= 4 ? matched : cards;
  if (matched.length < 4 && filters.topicTags.length > 0) {
    console.warn(
      "[point_race] Narrow content filter yielded too few cards; falling back to broader pool.",
      { filters, matched: matched.length, usedFallback }
    );
  }

  return pool;
}

export async function getFlashcardPool(
  supabase: SupabaseClient,
  settings?: GameRoomSettings | null
): Promise<FlashcardPoolCard[]> {
  const filters = topicFiltersFromSettings(settings);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const scope = await resolveGamesContentScope(supabase, user.id);
  const key = filtersCacheKey(
    filters,
    scope.mode,
    scope.mode === "english" ? scope.courseIds : []
  );
  const cached = poolCache.get(key);
  if (cached && cached.length >= 4) return cached;

  const pool = await loadFlashcardPool(supabase, settings);
  poolCache.set(key, pool);
  return pool;
}

export function buildRandomMcqQuestion(cards: FlashcardForMcq[]): McqQuestionPayload {
  const card = pickRandomItems(cards, 1)[0]!;
  return buildMcqPayload(card, cards);
}

export async function buildInitialRaceQuestions(
  supabase: SupabaseClient,
  playerIds: string[],
  settings?: GameRoomSettings | null
): Promise<Array<{ player_id: string; current_question_payload: McqQuestionPayload }>> {
  const cards = await getFlashcardPool(supabase, settings);

  return playerIds.map((player_id) => ({
    player_id,
    current_question_payload: buildRandomMcqQuestion(cards),
  }));
}
