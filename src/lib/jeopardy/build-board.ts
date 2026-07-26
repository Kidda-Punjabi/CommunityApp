import type { SupabaseClient } from "@supabase/supabase-js";
import {
  contentFiltersFromSettings,
  itemMatchesTopicTags,
} from "@/lib/group-games/content-filters";
import {
  buildMcqPayload,
  normalizeFlashcardRow,
  type FlashcardForMcq,
} from "@/lib/group-games/build-mcq-question";
import type { McqQuestionPayload } from "@/lib/group-games/buzz-race-types";
import type { GameRoomSettings } from "@/lib/game-rooms/types";

export const JEOPARDY_CATEGORIES = ["alphabet", "vocab", "sentences"] as const;
export type JeopardyCategory = (typeof JEOPARDY_CATEGORIES)[number];

export const JEOPARDY_POINT_VALUES = [100, 200, 300, 400, 500] as const;

export const JEOPARDY_CATEGORY_LABELS: Record<JeopardyCategory, string> = {
  alphabet: "Alphabet",
  vocab: "Vocab",
  sentences: "Sentences",
};

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
  const { data, error } = await supabase
    .from("flashcards")
    .select("id, front_text, back_text, romanised, category, difficulty, topic_tags");

  if (error) throw error;

  const allCards = (data ?? [])
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

  // Prefer topic-filtered pool; if empty, fall back so the board can still build.
  const cards = topicScoped.length > 0 ? topicScoped : allCards;
  if (filters.topicTags.length > 0 && topicScoped.length === 0) {
    console.warn(
      "[jeopardy] Topic filter matched no flashcards; falling back to full pool.",
      { topicTags: filters.topicTags }
    );
  }

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
