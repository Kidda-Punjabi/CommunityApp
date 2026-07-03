"use client";

import { laneX, laneY, SPRING_EASING } from "@/lib/games/lane-runner/config";
import type { LaneIndex } from "@/lib/games/lane-runner/types";

type LaneRunnerRunnerProps = {
  lane: LaneIndex;
  lean: "left" | "right" | null;
  landing: boolean;
};

export function LaneRunnerRunner({ lane, lean, landing }: LaneRunnerRunnerProps) {
  const leanDeg = lean === "left" ? -14 : lean === "right" ? 14 : 0;
  const bounceClass = lean ? "" : "lane-runner-idle";
  const contactProgress = 1;

  return (
    <div
      className="pointer-events-none absolute z-20"
      style={{
        left: `${laneX(lane, contactProgress)}%`,
        top: `${laneY(contactProgress)}%`,
        transform: "translate(-50%, -50%)",
        transition: `left 0.38s ${SPRING_EASING}`,
      }}
    >
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-full bg-violet-600 text-3xl text-white ${bounceClass} ${landing ? "lane-runner-land" : ""}`}
        style={{
          transform: `rotate(${leanDeg}deg) ${landing ? "scale(1.12, 0.9)" : "scale(1)"}`,
          transition: landing
            ? "transform 0.18s ease-out"
            : lean
              ? "transform 0.12s ease-out"
              : undefined,
        }}
        aria-hidden
      >
        🏃
      </div>
    </div>
  );
}
