"use client";

import { useLayoutEffect, useRef, useState } from "react";
import {
  COIN_CONTACT_HOLD_MS,
  COIN_END_SCALE,
  COIN_FALL_MS,
  COIN_START_SCALE,
  CONTACT_TOP_PERCENT,
  HORIZON_TOP_PERCENT,
  LANE_CENTER_PERCENT,
} from "@/lib/games/lane-runner/config";
import type { ActiveCoin, LaneIndex } from "@/lib/games/lane-runner/types";

type LaneRunnerCoinProps = {
  coin: ActiveCoin;
  onArrive: (coinId: string) => void;
};

export function LaneRunnerCoin({ coin, onArrive }: LaneRunnerCoinProps) {
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

    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setFallen(true));
    });
    return () => {
      cancelAnimationFrame(frame);
      if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    };
  }, [coin.id]);

  const isFalling = coin.status === "falling";
  const isHolding = coin.status === "holding";
  const atContact = fallen || isHolding || coin.status === "caught" || coin.status === "missed";

  const top = atContact ? CONTACT_TOP_PERCENT : HORIZON_TOP_PERCENT;
  const left = atContact ? LANE_CENTER_PERCENT[coin.targetLane] : 50;
  const scale = isFalling
    ? fallen
      ? COIN_END_SCALE
      : COIN_START_SCALE
    : coin.status === "caught"
      ? 1.5
      : 0.45;

  const statusClass =
    coin.status === "caught"
      ? "lane-runner-coin-caught"
      : coin.status === "missed"
        ? "lane-runner-coin-missed"
        : "";

  return (
    <div
      className={`pointer-events-none absolute z-[15] ${statusClass}`}
      style={{
        top: `${top}%`,
        left: `${left}%`,
        transform: `translate(-50%, -50%) scale(${scale})`,
        transition:
          isFalling && !fallen
            ? `top ${COIN_FALL_MS}ms linear, left ${COIN_FALL_MS}ms linear, transform ${COIN_FALL_MS}ms linear`
            : isFalling && fallen
              ? "none"
              : undefined,
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
        }, COIN_CONTACT_HOLD_MS);
      }}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-amber-700 bg-amber-400 text-lg font-bold text-amber-900">
        ○
      </div>
    </div>
  );
}

export function randomCoinLane(): LaneIndex {
  return Math.floor(Math.random() * 3) as LaneIndex;
}
