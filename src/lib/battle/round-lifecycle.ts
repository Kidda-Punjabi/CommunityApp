import type { SupabaseClient } from "@supabase/supabase-js";
import { roundMultiplier } from "@/lib/battle/scoring";
import { pickBattleQuestion } from "@/lib/battle/questions";
import { canResolveRound, computeRoundResolution } from "@/lib/battle/resolve-round";
import { loadBattleRound, loadBattleSession } from "@/lib/battle/load-battle";
import type { BattleRoundRow, BattleSessionRow } from "@/lib/battle/types";
import type { BattleGameSource } from "@/lib/battle/constants";
import { recordStreakActivity } from "@/lib/progress/streak";

export async function ensureCurrentBattleRound(
  supabase: SupabaseClient,
  sessionId: string,
  learnerLevel: number | null
): Promise<BattleRoundRow | null> {
  const session = await loadBattleSession(supabase, sessionId);
  if (!session || session.status !== "active") return null;

  const existing = await loadBattleRound(supabase, sessionId, session.current_round);
  if (existing) return existing;

  const question = await pickBattleQuestion(
    supabase,
    session.game_source as BattleGameSource,
    learnerLevel
  );

  const { data, error } = await supabase.rpc("battle_start_round", {
    p_session_id: sessionId,
    p_round_number: session.current_round,
    p_question_payload: question,
    p_round_multiplier: roundMultiplier(session.current_round),
  });

  if (error) throw error;

  const payload = data as {
    round_id: string;
    round_number: number;
    round_started_at: string;
    question_payload: BattleRoundRow["question_payload"];
  };

  return {
    id: payload.round_id,
    session_id: sessionId,
    round_number: payload.round_number,
    question_payload: payload.question_payload,
    round_started_at: payload.round_started_at,
    player_one_answer: null,
    player_one_answered_at: null,
    player_one_correct: null,
    player_two_answer: null,
    player_two_answered_at: null,
    player_two_correct: null,
    player_one_damage_dealt: 0,
    player_two_damage_dealt: 0,
    round_multiplier: roundMultiplier(session.current_round),
    resolved_at: null,
    player_one_ready_at: null,
    player_two_ready_at: null,
    round_active_at: null,
  };
}

export type RoundResolutionPayload = {
  resolved: boolean;
  alreadyResolved?: boolean;
  round?: BattleRoundRow;
  session?: BattleSessionRow;
  resolution?: ReturnType<typeof computeRoundResolution>;
};

export async function resolveBattleRoundIfReady(
  supabase: SupabaseClient,
  sessionId: string,
  roundNumber: number,
  learnerLevel: number | null
): Promise<RoundResolutionPayload> {
  const session = await loadBattleSession(supabase, sessionId);
  if (!session || session.status !== "active") {
    return { resolved: false };
  }

  const round = await loadBattleRound(supabase, sessionId, roundNumber);
  if (!round || round.resolved_at) {
    return { resolved: false, alreadyResolved: Boolean(round?.resolved_at) };
  }

  if (!canResolveRound(round)) {
    return { resolved: false };
  }

  const resolution = computeRoundResolution(session, round);

  const { data, error } = await supabase.rpc("battle_apply_round_resolution", {
    p_session_id: sessionId,
    p_round_number: roundNumber,
    p_player_one_damage_dealt: resolution.playerOneDamageDealt,
    p_player_two_damage_dealt: resolution.playerTwoDamageDealt,
    p_player_one_hp: resolution.playerOneHp,
    p_player_two_hp: resolution.playerTwoHp,
    p_winner_id: resolution.winnerId,
    p_session_status: resolution.sessionStatus,
    p_start_next_round: resolution.startNextRound,
  });

  if (error) throw error;

  const result = data as { already_resolved?: boolean; session?: BattleSessionRow };
  if (result.already_resolved) {
    return { resolved: false, alreadyResolved: true };
  }

  const updatedSession = result.session ?? session;
  const updatedRound = (await loadBattleRound(supabase, sessionId, roundNumber)) ?? round;

  // Finishing a battle counts as learning for the day (once-per-day RPC).
  if (resolution.sessionCompleted) {
    const playerIds = [session.player_one_id];
    if (session.player_two_id && !session.is_bot_opponent) {
      playerIds.push(session.player_two_id);
    }
    await Promise.all(
      playerIds.map((id) =>
        recordStreakActivity(supabase, id).catch(() => {
          /* non-fatal */
        })
      )
    );
  }

  return {
    resolved: true,
    round: updatedRound,
    session: updatedSession,
    resolution,
  };
}
