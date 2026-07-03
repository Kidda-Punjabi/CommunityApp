"use client";

import { useLayoutEffect, useRef, useState } from "react";
import {
  CONTACT_TOP_PERCENT,
  GATE_END_SCALE,
  GATE_FALL_MS,
  GATE_START_DELAY_MS,
  GATE_START_SCALE,
  HORIZON_TOP_PERCENT,
} from "@/lib/games/lane-runner/config";
import type { LaneRunnerGate } from "@/lib/games/lane-runner/types";

type LaneRunnerGateViewProps = {
  gate: LaneRunnerGate;
  gateKey: number;
  onArrive: () => void;
};

export function LaneRunnerGateView({ gate, gateKey, onArrive }: LaneRunnerGateViewProps) {
  const [fallen, setFallen] = useState(false);
  const arrivedRef = useRef(false);

  useLayoutEffect(() => {
    arrivedRef.current = false;
    setFallen(false);

    const delayTimer = window.setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setFallen(true));
      });
    }, GATE_START_DELAY_MS);

    return () => window.clearTimeout(delayTimer);
  }, [gateKey, gate.flashcard_id]);

  const top = fallen ? CONTACT_TOP_PERCENT : HORIZON_TOP_PERCENT;
  const scale = fallen ? GATE_END_SCALE : GATE_START_SCALE;

  return (
    <div
      key={gateKey}
      className="pointer-events-none absolute left-1/2 z-10 w-[96%] max-w-lg"
      style={{
        top: `${top}%`,
        transform: `translate(-50%, -50%) scale(${scale})`,
        transition: fallen
          ? `top ${GATE_FALL_MS}ms linear, transform ${GATE_FALL_MS}ms linear`
          : "none",
      }}
      onTransitionEnd={(event) => {
        if (event.propertyName !== "top" || arrivedRef.current || !fallen) return;
        arrivedRef.current = true;
        onArrive();
      }}
    >
      <div className="grid grid-cols-3 gap-2">
        {gate.laneAnswers.map((answer, lane) => (
          <div
            key={`${gateKey}-${lane}`}
            className="flex min-h-[5rem] flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white px-2 py-3 text-center shadow-sm"
          >
            <p className="text-base font-semibold leading-snug text-zinc-900 sm:text-lg">
              {answer.gurmukhi}
            </p>
            <p className="mt-1.5 text-xs font-medium leading-snug text-violet-600 sm:text-sm">
              {answer.romanised}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
