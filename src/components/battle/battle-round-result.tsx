"use client";

import type { BattlePlayerProfile } from "@/lib/battle/load-battle";
import type { BattleRoundRow } from "@/lib/battle/types";
import { ui } from "@/lib/ui/styles";

type BattleRoundResultProps = {
  round: BattleRoundRow;
  playerOne: BattlePlayerProfile;
  playerTwo: BattlePlayerProfile;
  youArePlayerOne: boolean;
};

function formatAnswer(answer: string | null, correct: boolean | null) {
  if (!answer) return "No answer (timed out)";
  const label = answer === "masculine" ? "Masculine" : answer === "feminine" ? "Feminine" : answer;
  if (correct === false) return `${label} ✗`;
  if (correct === true) return `${label} ✓`;
  return label;
}

export function BattleRoundResult({
  round,
  playerOne,
  playerTwo,
  youArePlayerOne,
}: BattleRoundResultProps) {
  const damageDealtByYou = youArePlayerOne
    ? round.player_one_damage_dealt
    : round.player_two_damage_dealt;
  const damageTakenByYou = youArePlayerOne
    ? round.player_two_damage_dealt
    : round.player_one_damage_dealt;

  return (
    <div className={`${ui.card} space-y-4 border border-violet-100`}>
      <p className="text-center text-sm font-semibold uppercase tracking-wider text-violet-600">
        Round {round.round_number} result
      </p>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-zinc-50 p-3">
          <p className="font-semibold text-zinc-900">{playerOne.displayName}</p>
          <p className="mt-1 text-zinc-600">
            {formatAnswer(round.player_one_answer, round.player_one_correct)}
          </p>
        </div>
        <div className="rounded-2xl bg-zinc-50 p-3 text-right">
          <p className="font-semibold text-zinc-900">{playerTwo.displayName}</p>
          <p className="mt-1 text-zinc-600">
            {formatAnswer(round.player_two_answer, round.player_two_correct)}
          </p>
        </div>
      </div>

      {damageDealtByYou > 0 ? (
        <p className="text-center text-base font-semibold text-zinc-900">
          You dealt {damageDealtByYou} damage!
        </p>
      ) : damageTakenByYou > 0 ? (
        <p className="text-center text-base font-semibold text-zinc-900">
          You took {damageTakenByYou} damage.
        </p>
      ) : (
        <p className="text-center text-sm text-zinc-500">No damage this round.</p>
      )}
    </div>
  );
}
