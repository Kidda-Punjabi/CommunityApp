"use server";

import { createClient } from "@/lib/supabase/server";
import { buildRandomMcqQuestion, getFlashcardPool } from "@/lib/point-race/build-questions";
import type { McqQuestionPayload } from "@/lib/group-games/buzz-race-types";

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

export async function submitRaceAnswerAction(answer: string): Promise<RaceActionResult> {
  const supabase = await createClient();
  const cards = await getFlashcardPool(supabase);
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
