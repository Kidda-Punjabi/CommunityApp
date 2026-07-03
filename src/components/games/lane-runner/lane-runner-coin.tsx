"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { shuffleArray } from "@/lib/flashcards/utils";
import {
  COLLECTIBLE_CONTACT_HOLD_MS,
  COIN_END_SCALE,
  COIN_START_SCALE,
  laneX,
  laneY,
} from "@/lib/games/lane-runner/config";
import type { ActiveCoin, LaneIndex } from "@/lib/games/lane-runner/types";

type LaneRunnerCoinProps = {
  coin: ActiveCoin;
  fallDurationMs: number;
  onArrive: (coinId: string) => void;
};

export function LaneRunnerCoin({ coin, fallDurationMs, onArrive }: LaneRunnerCoinProps) {
  const [fallen, setFallen] = useState(false);
  const arrivedRef = useRef(false);
  const holdTimerRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    arrivedRef.current = false;
    setFallen(false);
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    const delayTimer = window.setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setFallen(true));
      });
    }, coin.startDelayMs);

    return () => {
      window.clearTimeout(delayTimer);
      if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    };
  }, [coin.id, coin.startDelayMs]);

  const isFalling = coin.status === "falling";
  const progress = fallen ? 1 : 0;
  const left = laneX(coin.targetLane, progress);
  const top = laneY(progress);
  const scale = isFalling
    ? fallen
      ? COIN_END_SCALE
      : COIN_START_SCALE
    : coin.status === "caught"
      ? 1.5
      : 0.45;

  const statusClass =
    coin.status === "missed" ? "lane-runner-coin-missed" : "";

  const bodyClass =
    coin.status === "caught" ? "lane-runner-coin-caught-inner" : "";

  return (
    <div
      className={`pointer-events-none absolute z-[15] ${statusClass}`}
      style={{
        left: `${left}%`,
        top: `${top}%`,
        transform: `translate(-50%, -50%) scale(${scale})`,
        transition:
          fallen && isFalling
            ? `left ${fallDurationMs}ms linear, top ${fallDurationMs}ms linear, transform ${fallDurationMs}ms linear`
            : "none",
      }}
      onTransitionEnd={(event) => {
        if (
          coin.status !== "falling" ||
          event.propertyName !== "top" ||
          arrivedRef.current ||
          !fallen
        ) {
          return;
        }
        arrivedRef.current = true;
        holdTimerRef.current = window.setTimeout(() => {
          onArrive(coin.id);
        }, COLLECTIBLE_CONTACT_HOLD_MS);
      }}
    >
      {coin.status === "caught" ? (
        <>
          <span className="lane-runner-coin-catch-ring" aria-hidden />
          <span className="lane-runner-coin-reward-pop" aria-hidden>
            +1
          </span>
        </>
      ) : null}
      <div
        className={`lane-runner-coin-body flex h-9 w-9 items-center justify-center rounded-full border-2 border-amber-700 bg-amber-400 text-lg font-bold text-amber-900 ${bodyClass}`}
      >
        ○
      </div>
    </div>
  );
}

export function randomCoinLane(): LaneIndex {
  return Math.floor(Math.random() * 3) as LaneIndex;
}

/** One coin per lane when count ≥ 3; otherwise random lanes. */
export function coinLanesForRound(count: number): LaneIndex[] {
  const lanes: LaneIndex[] = [0, 1, 2];
  if (count >= lanes.length) {
    return shuffleArray(lanes) as LaneIndex[];
  }
  return Array.from({ length: count }, () => randomCoinLane());
}
