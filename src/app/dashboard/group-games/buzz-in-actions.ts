"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type BuzzInActionResult = {
  error?: string;
  claimed?: boolean;
  buzzedBy?: string | null;
  resolved?: boolean;
  answerCorrect?: boolean;
  correctAnswer?: string;
  gameCompleted?: boolean;
};

export async function claimBuzzIn(roundId: string): Promise<BuzzInActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("buzz_in", { p_round_id: roundId });

  if (error) return { error: error.message };

  const payload = data as {
    claimed: boolean;
    buzzed_by?: string;
  };

  return {
    claimed: payload.claimed,
    buzzedBy: payload.buzzed_by ?? null,
  };
}

export async function submitBuzzInAnswer(
  roundId: string,
  answer: string
): Promise<BuzzInActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_buzz_answer", {
    p_round_id: roundId,
    p_answer: answer,
  });

  if (error) return { error: error.message };

  const payload = data as {
    already_resolved?: boolean;
    resolved?: boolean;
    answer_correct?: boolean;
    correct_answer?: string;
    advance?: { game_completed?: boolean };
  };

  if (payload.already_resolved) {
    return { resolved: true };
  }

  return {
    resolved: payload.resolved,
    answerCorrect: payload.answer_correct,
    correctAnswer: payload.correct_answer,
    gameCompleted: payload.advance?.game_completed,
  };
}

export async function resolveBuzzInTimeout(roundId: string): Promise<BuzzInActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resolve_buzz_in_timeout", {
    p_round_id: roundId,
  });

  if (error) {
    if (error.message.includes("has not elapsed")) {
      return { error: undefined };
    }
    return { error: error.message };
  }

  const payload = data as {
    already_resolved?: boolean;
    resolved?: boolean;
    answer_correct?: boolean;
    correct_answer?: string;
    advance?: { game_completed?: boolean };
  };

  if (payload.already_resolved) {
    return { resolved: true };
  }

  return {
    resolved: payload.resolved,
    answerCorrect: payload.answer_correct,
    correctAnswer: payload.correct_answer,
    gameCompleted: payload.advance?.game_completed,
  };
}

export async function refreshBuzzInPath(roomId: string): Promise<void> {
  revalidatePath(`/dashboard/group-games/room/${roomId}/play`);
}
