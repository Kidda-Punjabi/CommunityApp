"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  COIN_END_SCALE,
  COIN_START_SCALE,
  FALL_MOTION_EASING,
  GATE_END_SCALE,
  GATE_START_DELAY_MS,
  GATE_START_SCALE,
  laneX,
  laneY,
} from "@/lib/games/lane-runner/config";
import type { LaneIndex, LaneRunnerGate } from "@/lib/games/lane-runner/types";

type LaneRunnerGateViewProps = {
  gate: LaneRunnerGate;
  gateKey: number;
  fallDurationMs: number;
  startDelayMs?: number;
  /** When false the gate stays parked at the horizon. */
  canFall: boolean;
  onArrive: () => void;
  onFallStart?: () => void;
};

function GateTile({
  lane,
  fallen,
  fallDurationMs,
  gurmukhi,
  romanised,
  onFallComplete,
}: {
  lane: LaneIndex;
  fallen: boolean;
  fallDurationMs: number;
  gurmukhi: string;
  romanised: string;
  onFallComplete?: () => void;
}) {
  const progress = fallen ? 1 : 0;
  const left = laneX(lane, progress);
  const top = laneY(progress);
  const scale = fallen ? GATE_END_SCALE : GATE_START_SCALE;

  return (
    <div
      className="pointer-events-none absolute z-10 w-[30%] max-w-[7.5rem]"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        transform: `translate(-50%, -50%) scale(${scale})`,
        transition: fallen
          ? `left ${fallDurationMs}ms ${FALL_MOTION_EASING}, top ${fallDurationMs}ms ${FALL_MOTION_EASING}, transform ${fallDurationMs}ms ${FALL_MOTION_EASING}`
          : "none",
      }}
      onTransitionEnd={(event) => {
        if (event.propertyName !== "top" || !fallen || !onFallComplete) return;
        onFallComplete();
      }}
    >
      <div className="flex min-h-[5rem] flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white px-2 py-3 text-center shadow-sm">
        <p className="text-base font-semibold leading-snug text-zinc-900 sm:text-lg">{gurmukhi}</p>
        <p className="mt-1.5 text-xs font-medium leading-snug text-violet-600 sm:text-sm">
          {romanised}
        </p>
      </div>
    </div>
  );
}

export function LaneRunnerGateView({
  gate,
  gateKey,
  fallDurationMs,
  startDelayMs = GATE_START_DELAY_MS,
  canFall,
  onArrive,
  onFallStart,
}: LaneRunnerGateViewProps) {
  const [fallen, setFallen] = useState(false);
  const arrivedRef = useRef(false);
  const fallStartRef = useRef(false);
  const onFallStartRef = useRef(onFallStart);

  useEffect(() => {
    onFallStartRef.current = onFallStart;
  }, [onFallStart]);

  useLayoutEffect(() => {
    arrivedRef.current = false;
    fallStartRef.current = false;
    setFallen(false);

    if (!canFall) return;

    const delayTimer = window.setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!fallStartRef.current) {
            fallStartRef.current = true;
            onFallStartRef.current?.();
          }
          setFallen(true);
        });
      });
    }, startDelayMs);

    return () => window.clearTimeout(delayTimer);
  }, [gateKey, gate.flashcard_id, startDelayMs, canFall]);

  useEffect(() => {
    if (!canFall || !fallen) return;
    const fallbackTimer = window.setTimeout(() => {
      if (arrivedRef.current) return;
      arrivedRef.current = true;
      onArrive();
    }, fallDurationMs + 80);
    return () => window.clearTimeout(fallbackTimer);
  }, [canFall, fallen, fallDurationMs, onArrive]);

  return (
    <>
      {gate.laneAnswers.map((answer, lane) => (
        <GateTile
          key={`${gateKey}-${lane}`}
          lane={lane as LaneIndex}
          fallen={fallen}
          fallDurationMs={fallDurationMs}
          gurmukhi={answer.gurmukhi}
          romanised={answer.romanised}
          onFallComplete={
            lane === 0
              ? () => {
                  if (arrivedRef.current) return;
                  arrivedRef.current = true;
                  onArrive();
                }
              : undefined
          }
        />
      ))}
    </>
  );
}
