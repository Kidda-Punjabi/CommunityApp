"use server";

import { createClient } from "@/lib/supabase/server";
import { buildRandomMcqQuestion, getFlashcardPool } from "@/lib/point-race/build-questions";
import type { McqQuestionPayload } from "@/lib/group-games/buzz-race-types";
import type { GameRoomSettings } from "@/lib/game-rooms/types";

export type RaceActionResult = {
  error?: string;
  wasCorrect?: boolean;
  correctAnswer?: string;
  newScore?: number;
  nextQuestion?: McqQuestionPayload;
  gameCompleted?: boolean;
  isWinner?: boolean;
  alreadyAnswered?: boolean;
  gameEnded?: boolean;
};

async function loadActivePointRaceSettings(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<GameRoomSettings | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: raceState } = await supabase
    .from("game_room_race_state")
    .select("room_id")
    .eq("player_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!raceState?.room_id) return null;

  const { data: room } = await supabase
    .from("game_rooms")
    .select("settings, status, game_type")
    .eq("id", raceState.room_id)
    .maybeSingle();

  if (!room || room.game_type !== "point_race" || room.status !== "in_progress") {
    return null;
  }

  return (room.settings as GameRoomSettings) ?? null;
}

export async function submitRaceAnswerAction(answer: string): Promise<RaceActionResult> {
  const supabase = await createClient();
  const settings = await loadActivePointRaceSettings(supabase);
  const cards = await getFlashcardPool(supabase, settings);
  const nextQuestion = buildRandomMcqQuestion(cards);

  const { data, error } = await supabase.rpc("submit_race_answer", {
    p_answer: answer,
    p_next_question: nextQuestion,
  });

  if (error) return { error: error.message };

  const payload = data as {
    already_answered?: boolean;
    game_ended?: boolean;
    was_correct?: boolean;
    correct_answer?: string;
    new_score?: number;
    current_question_payload?: McqQuestionPayload;
    game_completed?: boolean;
    is_winner?: boolean;
  };

  if (payload.already_answered) return { alreadyAnswered: true };
  if (payload.game_ended) return { gameEnded: true };

  return {
    wasCorrect: payload.was_correct,
    correctAnswer: payload.correct_answer,
    newScore: payload.new_score,
    nextQuestion: payload.current_question_payload,
    gameCompleted: payload.game_completed,
    isWinner: payload.is_winner,
  };
}
