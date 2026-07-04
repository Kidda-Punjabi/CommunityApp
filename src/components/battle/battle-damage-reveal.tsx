"use client";

import type { BattlePlayerProfile } from "@/lib/battle/load-battle";
import { computeRoundScoreBreakdown } from "@/lib/battle/scoring";
import type { BattleRoundRow } from "@/lib/battle/types";
import { ui } from "@/lib/ui/styles";
import { useEffect, useMemo, useRef, useState } from "react";

type BattleDamageRevealProps = {
  round: BattleRoundRow;
  playerOne: BattlePlayerProfile;
  playerTwo: BattlePlayerProfile;
  preRoundPlayerOneHp: number;
  preRoundPlayerTwoHp: number;
  onComplete: (result: {
    displayPlayerOneHp: number;
    displayPlayerTwoHp: number;
    damageRecipient: "player_one" | "player_two" | null;
    finalDamage: number;
  }) => void;
};

const STEP_ORDER = [
  "score_p1",
  "score_p2",
  "difference",
  "multiplier",
  "final",
  "animating",
] as const;

type RevealStep = (typeof STEP_ORDER)[number] | "done";

const STEP_MS = 750;

function toPlayerInput(correct: boolean | null, answeredAt: string | null) {
  if (!answeredAt) return { correct: false, answeredAtIso: null };
  return { correct: correct ?? false, answeredAtIso: answeredAt };
}

export function BattleDamageReveal({
  round,
  playerOne,
  playerTwo,
  preRoundPlayerOneHp,
  preRoundPlayerTwoHp,
  onComplete,
}: BattleDamageRevealProps) {
  const [step, setStep] = useState<RevealStep>("score_p1");
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const breakdown = useMemo(() => {
    return computeRoundScoreBreakdown(
      round.round_number,
      round.round_started_at,
      round.round_active_at,
      toPlayerInput(round.player_one_correct, round.player_one_answered_at),
      toPlayerInput(round.player_two_correct, round.player_two_answered_at)
    );
  }, [round]);

  const postHp = useMemo(() => {
    let p1 = preRoundPlayerOneHp;
    let p2 = preRoundPlayerTwoHp;
    if (breakdown.damageRecipient === "player_one") p1 -= breakdown.finalDamage;
    if (breakdown.damageRecipient === "player_two") p2 -= breakdown.finalDamage;
    return { p1: Math.max(0, p1), p2: Math.max(0, p2) };
  }, [breakdown, preRoundPlayerOneHp, preRoundPlayerTwoHp]);

  useEffect(() => {
    const steps: RevealStep[] =
      breakdown.finalDamage > 0
        ? [...STEP_ORDER]
        : (["score_p1", "score_p2", "difference"] as RevealStep[]);

    let index = 0;
    setStep(steps[0]);

    const finish = () => {
      setStep("done");
      onCompleteRef.current({
        displayPlayerOneHp: postHp.p1,
        displayPlayerTwoHp: postHp.p2,
        damageRecipient: breakdown.damageRecipient,
        finalDamage: breakdown.finalDamage,
      });
    };

    const advance = () => {
      index += 1;
      if (index >= steps.length) {
        if (breakdown.finalDamage > 0) {
          setStep("animating");
          window.setTimeout(finish, 950);
        } else {
          finish();
        }
        return;
      }
      setStep(steps[index]);
      window.setTimeout(advance, STEP_MS);
    };

    const timer = window.setTimeout(advance, STEP_MS);
    return () => window.clearTimeout(timer);
  }, [breakdown, postHp]);

  const rank = step === "done" ? STEP_ORDER.length : STEP_ORDER.indexOf(step as (typeof STEP_ORDER)[number]);

  const recipientName =
    breakdown.damageRecipient === "player_one"
      ? playerOne.displayName
      : breakdown.damageRecipient === "player_two"
        ? playerTwo.displayName
        : null;

  return (
    <div className={`${ui.card} space-y-3 border border-violet-100`}>
      <p className="text-center text-sm font-semibold uppercase tracking-wider text-violet-600">
        Round {round.round_number} result
      </p>

      <div className="min-h-[8rem] space-y-2 text-center text-sm">
        {rank >= 0 ? (
          <p className="font-medium text-zinc-800">
            {playerOne.displayName} — {breakdown.playerOneScore} pts
          </p>
        ) : null}

        {rank >= 1 ? (
          <p className="font-medium text-zinc-800">
            {playerTwo.displayName} — {breakdown.playerTwoScore} pts
          </p>
        ) : null}

        {rank >= 2 ? (
          <p className="text-zinc-600">
            {Math.max(breakdown.playerOneScore, breakdown.playerTwoScore)} −{" "}
            {Math.min(breakdown.playerOneScore, breakdown.playerTwoScore)} ={" "}
            {breakdown.scoreDifference}
          </p>
        ) : null}

        {rank >= 3 && breakdown.scoreDifference > 0 ? (
          <p className="text-zinc-600">
            {breakdown.scoreDifference} × {breakdown.multiplier.toFixed(1)} ={" "}
            {breakdown.unroundedDamage.toFixed(1)}
          </p>
        ) : null}

        {rank >= 4 && breakdown.finalDamage > 0 && recipientName ? (
          <p className="text-base font-semibold text-zinc-900">
            {breakdown.finalDamage} damage → {recipientName}
          </p>
        ) : null}

        {rank >= 2 && breakdown.finalDamage === 0 ? (
          <p className="text-zinc-500">No damage this round.</p>
        ) : null}

        {step === "animating" ? (
          <p className="text-xs text-zinc-400">Applying damage…</p>
        ) : null}
      </div>
    </div>
  );
}
