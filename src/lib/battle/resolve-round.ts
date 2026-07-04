import { BATTLE_ROUND_TIMEOUT_MS } from "@/lib/battle/constants";
import { resolveRoundDamage, type PlayerRoundInput } from "@/lib/battle/scoring";
import type { BattleRoundRow, BattleSessionRow } from "@/lib/battle/types";

export function roundTimerStartAt(round: BattleRoundRow): string | null {
  return round.round_active_at;
}

export function isRoundTimedOut(round: BattleRoundRow, nowMs = Date.now()): boolean {
  const startAt = roundTimerStartAt(round);
  if (!startAt) return false;
  return nowMs - new Date(startAt).getTime() >= BATTLE_ROUND_TIMEOUT_MS;
}

function toPlayerInput(
  correct: boolean | null,
  answeredAt: string | null,
  forcedIncorrect: boolean
): PlayerRoundInput {
  if (forcedIncorrect || !answeredAt) {
    return { correct: false, answeredAtIso: null };
  }
  return { correct: correct ?? false, answeredAtIso: answeredAt };
}

export type ComputedRoundResolution = {
  playerOneRawDamage: number;
  playerTwoRawDamage: number;
  netDamage: number;
  damageRecipient: "player_one" | "player_two" | null;
  finalDamage: number;
  playerOneDamageDealt: number;
  playerTwoDamageDealt: number;
  playerOneHp: number;
  playerTwoHp: number;
  winnerId: string | null;
  sessionCompleted: boolean;
  sessionStatus: "active" | "completed";
  startNextRound: boolean;
};

export function computeRoundResolution(
  session: BattleSessionRow,
  round: BattleRoundRow,
  options?: { treatMissingAsTimedOut?: boolean; nowMs?: number }
): ComputedRoundResolution {
  const nowMs = options?.nowMs ?? Date.now();
  const timedOut = isRoundTimedOut(round, nowMs);
  const treatMissing = options?.treatMissingAsTimedOut ?? timedOut;

  const playerOne = toPlayerInput(
    round.player_one_correct,
    round.player_one_answered_at,
    treatMissing && !round.player_one_answered_at
  );
  const playerTwo = toPlayerInput(
    round.player_two_correct,
    round.player_two_answered_at,
    treatMissing && !round.player_two_answered_at
  );

  const timerStart = round.round_active_at ?? round.round_started_at;
  const damage = resolveRoundDamage(
    round.round_number,
    timerStart,
    playerOne,
    playerTwo
  );

  let playerOneHp = session.player_one_hp;
  let playerTwoHp = session.player_two_hp;

  if (damage.damageRecipient === "player_one") {
    playerOneHp -= damage.finalDamage;
  } else if (damage.damageRecipient === "player_two") {
    playerTwoHp -= damage.finalDamage;
  }

  let winnerId: string | null = null;
  let sessionCompleted = false;

  if (playerOneHp <= 0 && session.player_two_id) {
    winnerId = session.player_two_id;
    sessionCompleted = true;
  } else if (playerTwoHp <= 0) {
    winnerId = session.player_one_id;
    sessionCompleted = true;
  }

  return {
    ...damage,
    playerOneHp,
    playerTwoHp,
    winnerId,
    sessionCompleted,
    sessionStatus: sessionCompleted ? "completed" : "active",
    startNextRound: !sessionCompleted,
  };
}

export function canResolveRound(round: BattleRoundRow, nowMs = Date.now()): boolean {
  if (round.resolved_at) return false;
  if (!round.round_active_at) return false;
  const bothAnswered =
    round.player_one_answered_at !== null && round.player_two_answered_at !== null;
  if (bothAnswered) return true;
  return isRoundTimedOut(round, nowMs);
}
