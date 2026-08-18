import type { SupabaseClient } from "@supabase/supabase-js";
import {
  contentFiltersFromSettings,
  itemMatchesTopicTags,
  noQuestionsForTopicError,
} from "@/lib/group-games/content-filters";
import {
  buildMcqPayload,
  normalizeFlashcardRow,
  type FlashcardForMcq,
} from "@/lib/group-games/build-mcq-question";
import type { McqQuestionPayload } from "@/lib/group-games/buzz-race-types";
import type { GameRoomSettings } from "@/lib/game-rooms/types";
import { loadScopedFlashcardPoolRows } from "@/lib/games/load-scoped-flashcards";
import {
  JEOPARDY_CATEGORIES,
  JEOPARDY_POINT_VALUES,
  type JeopardyCategory,
} from "@/lib/jeopardy/constants";

export {
  JEOPARDY_CATEGORIES,
  JEOPARDY_CATEGORY_LABELS,
  JEOPARDY_POINT_VALUES,
  type JeopardyCategory,
} from "@/lib/jeopardy/constants";

export type SkippedJeopardyTile = {
  category: JeopardyCategory;
  point_value: number;
  difficulty: number;
  reason: string;
};

export type JeopardyTileInsert = {
  category: JeopardyCategory;
  point_value: number;
  flashcard_id: string;
  question_payload: McqQuestionPayload;
};

type FlashcardWithDifficulty = FlashcardForMcq & {
  difficulty: number | null;
  topic_tags: string[];
};

function pickCardForSlot(
  cards: FlashcardWithDifficulty[],
  category: JeopardyCategory,
  difficulty: number,
  usedIds: Set<string>
): FlashcardWithDifficulty | null {
  const inCategory = cards.filter(
    (c) => c.category === category && !usedIds.has(c.id)
  );
  if (inCategory.length === 0) return null;

  let matches = inCategory.filter((c) => c.difficulty === difficulty);
  if (matches.length === 0) {
    const adjacent = [difficulty - 1, difficulty + 1, difficulty - 2, difficulty + 2].filter(
      (d) => d >= 1 && d <= 5
    );
    for (const d of adjacent) {
      matches = inCategory.filter((c) => c.difficulty === d);
      if (matches.length > 0) break;
    }
  }

  if (matches.length === 0) return null;

  return matches[Math.floor(Math.random() * matches.length)] ?? null;
}

export type JeopardyBoardBuildResult = {
  tiles: JeopardyTileInsert[];
  skipped: SkippedJeopardyTile[];
};

export async function buildJeopardyBoard(
  supabase: SupabaseClient,
  settings?: GameRoomSettings | null
): Promise<JeopardyBoardBuildResult> {
  const filters = contentFiltersFromSettings(settings);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

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
    filters.topicTags.length > 0
      ? { overlaps: { topic_tags: filters.topicTags } }
      : undefined
  );

  if (error) throw new Error(error);

  const allCards = rows
    .map((row) => {
      const normalized = normalizeFlashcardRow(row);
      if (!normalized) return null;
      return {
        ...normalized,
        topic_tags: Array.isArray(row.topic_tags) ? row.topic_tags.map(String) : [],
      };
    })
    .filter((card): card is FlashcardWithDifficulty => card !== null);

  const topicScoped =
    filters.topicTags.length === 0
      ? allCards
      : allCards.filter((card) => itemMatchesTopicTags(card.topic_tags, filters.topicTags));

  if (filters.topicTags.length > 0 && topicScoped.length === 0) {
    throw noQuestionsForTopicError(filters.topicTags);
  }

  const cards = topicScoped;

  const usedIds = new Set<string>();
  const tiles: JeopardyTileInsert[] = [];
  const skipped: SkippedJeopardyTile[] = [];

  for (const category of JEOPARDY_CATEGORIES) {
    for (let difficulty = 1; difficulty <= 5; difficulty += 1) {
      const pointValue = difficulty * 100;
      const card = pickCardForSlot(cards, category, difficulty, usedIds);

      if (!card) {
        skipped.push({
          category,
          point_value: pointValue,
          difficulty,
          reason:
            filters.topicTags.length > 0
              ? `No flashcard for ${category} at difficulty ${difficulty} (or adjacent) within topics [${filters.topicTags.join(", ")}]`
              : `No flashcard for ${category} at difficulty ${difficulty} (or adjacent)`,
        });
        continue;
      }

      usedIds.add(card.id);
      tiles.push({
        category,
        point_value: pointValue,
        flashcard_id: card.id,
        question_payload: buildMcqPayload(card, cards),
      });
    }
  }

  if (tiles.length === 0) {
    throw new Error("Could not build any Jeopardy tiles — check flashcards content.");
  }

  if (skipped.length > 0) {
    console.warn("[jeopardy] Skipped tiles during board generation:", skipped);
  }

  return { tiles, skipped };
}

export async function pickInitialJeopardyPicker(
  supabase: SupabaseClient,
  roomId: string,
  hostId: string
): Promise<string> {
  const { data, error } = await supabase
    .from("game_room_participants")
    .select("user_id, is_host, is_playing, joined_at")
    .eq("room_id", roomId)
    .is("left_at", null)
    .eq("is_playing", true)
    .order("joined_at", { ascending: true });

  if (error) throw error;
  if (!data?.length) {
    throw new Error("No playing participants to pick first.");
  }

  const hostPlaying = data.find((p) => p.user_id === hostId);
  if (hostPlaying) return hostId;

  return data[0]!.user_id;
}
