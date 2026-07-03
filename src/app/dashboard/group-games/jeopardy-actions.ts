"use server";

import { createClient } from "@/lib/supabase/server";

export type JeopardyActionResult = {
  error?: string;
  claimed?: boolean;
  buzzedBy?: string | null;
  resolved?: boolean;
  answerCorrect?: boolean;
  correctAnswer?: string;
  gameCompleted?: boolean;
};

export async function selectJeopardyTile(tileId: string): Promise<JeopardyActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("select_jeopardy_tile", { p_tile_id: tileId });
  if (error) return { error: error.message };
  return {};
}

export async function claimJeopardyBuzz(tileId: string): Promise<JeopardyActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("jeopardy_buzz", { p_tile_id: tileId });
  if (error) return { error: error.message };

  const payload = data as { claimed: boolean; buzzed_by?: string };
  return { claimed: payload.claimed, buzzedBy: payload.buzzed_by ?? null };
}

export async function submitJeopardyAnswer(
  tileId: string,
  answer: string
): Promise<JeopardyActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_jeopardy_answer", {
    p_tile_id: tileId,
    p_answer: answer,
  });
  if (error) return { error: error.message };

  const payload = data as {
    already_resolved?: boolean;
    resolved?: boolean;
    answer_correct?: boolean;
    correct_answer?: string;
    complete?: { game_completed?: boolean };
  };

  if (payload.already_resolved) return { resolved: true };

  return {
    resolved: payload.resolved,
    answerCorrect: payload.answer_correct,
    correctAnswer: payload.correct_answer,
    gameCompleted: payload.complete?.game_completed,
  };
}

export async function resolveJeopardyTimeout(tileId: string): Promise<JeopardyActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resolve_jeopardy_timeout", {
    p_tile_id: tileId,
  });

  if (error) {
    if (error.message.includes("has not elapsed")) return {};
    return { error: error.message };
  }

  const payload = data as {
    already_resolved?: boolean;
    resolved?: boolean;
    answer_correct?: boolean;
    correct_answer?: string;
    complete?: { game_completed?: boolean };
  };

  if (payload.already_resolved) return { resolved: true };

  return {
    resolved: payload.resolved,
    answerCorrect: payload.answer_correct,
    correctAnswer: payload.correct_answer,
    gameCompleted: payload.complete?.game_completed,
  };
}
