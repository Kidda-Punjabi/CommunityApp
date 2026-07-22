"use server";

import { createClient } from "@/lib/supabase/server";
import { addLadderQuestionIfNeeded } from "@/lib/chado-pauri-group/load-ladder";

export type LadderActionResult = {
  error?: string;
  correct?: boolean;
  runCompleted?: boolean;
  gameCompleted?: boolean;
  hint?: string;
  eliminatedOptions?: string[];
  tally?: Record<string, number>;
};

export async function submitLadderAnswerAction(
  questionId: string,
  answer: string
): Promise<LadderActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_ladder_answer", {
    p_question_id: questionId,
    p_answer: answer,
  });

  if (error) return { error: error.message };

  const payload = data as {
    already_resolved?: boolean;
    correct?: boolean;
    run_completed?: boolean;
    game_completed?: boolean;
    run_id?: string;
    need_question_rung?: number;
  };

  if (payload.correct && !payload.run_completed && payload.need_question_rung && payload.run_id) {
    await addLadderQuestionIfNeeded(supabase, payload.run_id, payload.need_question_rung);
  }

  return {
    correct: payload.correct,
    runCompleted: payload.run_completed,
    gameCompleted: payload.game_completed,
  };
}

export async function useHalfHalfAction(questionId: string): Promise<LadderActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("use_half_half", { p_question_id: questionId });
  if (error) return { error: error.message };

  const payload = data as { eliminated_options?: string[] };
  return {
    eliminatedOptions: payload.eliminated_options ?? [],
  };
}

export async function useAskTutorAction(questionId: string): Promise<LadderActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("use_ask_tutor", { p_question_id: questionId });
  if (error) return { error: error.message };

  const payload = data as { hint?: string };
  return { hint: payload.hint };
}

export async function useAskRoomAction(questionId: string): Promise<LadderActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("use_ask_room", { p_question_id: questionId });
  if (error) return { error: error.message };
  const payload = data as { tally?: Record<string, number> };
  return { tally: payload.tally };
}
