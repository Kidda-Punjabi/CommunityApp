"use client";

import { useLayoutEffect, useRef, useState } from "react";
import {
  COLLECTIBLE_CONTACT_HOLD_MS,
  LETTER_END_SCALE,
  LETTER_START_SCALE,
  laneX,
  laneY,
} from "@/lib/games/lane-runner/config";
import type { ActiveLetter } from "@/lib/games/lane-runner/types";

type LaneRunnerLetterProps = {
  letter: ActiveLetter;
  fallDurationMs: number;
  onArrive: (letterId: string) => void;
};

export function LaneRunnerLetter({ letter, fallDurationMs, onArrive }: LaneRunnerLetterProps) {
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
  }, [letter.id]);

  const isFalling = letter.status === "falling";
  const progress = fallen ? 1 : 0;
  const left = laneX(letter.targetLane, progress);
  const top = laneY(progress);
  const scale = isFalling
    ? fallen
      ? LETTER_END_SCALE
      : LETTER_START_SCALE
    : letter.status === "caught"
      ? 1.4
      : 0.4;

  const statusClass =
    letter.status === "caught"
      ? "lane-runner-letter-caught"
      : letter.status === "missed"
        ? "lane-runner-letter-missed"
        : "";

  return (
    <div
      className={`pointer-events-none absolute z-[16] ${statusClass}`}
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
          letter.status !== "falling" ||
          event.propertyName !== "top" ||
          arrivedRef.current ||
          !fallen
        ) {
          return;
        }
        arrivedRef.current = true;
        holdTimerRef.current = window.setTimeout(() => {
          onArrive(letter.id);
        }, COLLECTIBLE_CONTACT_HOLD_MS);
      }}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-md border-2 border-violet-800 bg-violet-600 text-lg font-bold text-white shadow-sm">
        {letter.letter}
      </div>
    </div>
  );
}
