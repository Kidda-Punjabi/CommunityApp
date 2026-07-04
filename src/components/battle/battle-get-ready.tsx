"use client";

import { BATTLE_GET_READY_MS } from "@/lib/battle/constants";
import { ui } from "@/lib/ui/styles";
import { useEffect } from "react";

type BattleGetReadyProps = {
  roundNumber: number;
  multiplier: number;
  waitingForOpponent?: boolean;
  opponentName?: string;
  onComplete: () => void;
};

export function BattleGetReady({
  roundNumber,
  multiplier,
  waitingForOpponent,
  opponentName,
  onComplete,
}: BattleGetReadyProps) {
  useEffect(() => {
    if (waitingForOpponent) return;
    const timer = window.setTimeout(onComplete, BATTLE_GET_READY_MS);
    return () => window.clearTimeout(timer);
  }, [waitingForOpponent, onComplete]);

  return (
    <div className={`${ui.card} text-center`}>
      <p className="text-3xl" aria-hidden="true">
        ⚔️
      </p>
      <h2 className="mt-3 text-2xl font-bold text-zinc-900">Get ready</h2>
      {waitingForOpponent ? (
        <p className="mt-2 text-sm text-zinc-500">
          Waiting for {opponentName ?? "opponent"}…
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-zinc-600">
            Round {roundNumber} — damage multiplier now ×{multiplier.toFixed(1)}
          </p>
          <p className="mt-1 text-xs text-zinc-400">Starting soon…</p>
        </>
      )}
    </div>
  );
}
