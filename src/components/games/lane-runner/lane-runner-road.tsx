"use client";

import { useEffect, useState } from "react";
import {
  DASH_CYCLE_PX,
  DASH_SCROLL_SPEED,
  laneBoundarySegment,
  laneY,
} from "@/lib/games/lane-runner/config";

type LaneRunnerRoadProps = {
  flash: "hit" | "miss" | null;
  children: React.ReactNode;
};

export function LaneRunnerRoad({ flash, children }: LaneRunnerRoadProps) {
  const [dashOffset, setDashOffset] = useState(0);

  useEffect(() => {
    let offset = 0;
    let raf = 0;

    const tick = () => {
      offset += DASH_SCROLL_SPEED;
      if (offset >= DASH_CYCLE_PX) offset -= DASH_CYCLE_PX;
      setDashOffset(offset);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const dividers = ([0, 1] as const).map((boundary) => laneBoundarySegment(boundary));

  return (
    <div className="relative grid min-h-[28rem] flex-1 grid-rows-[minmax(5.5rem,32%)_minmax(18rem,1fr)] overflow-hidden rounded-xl border border-zinc-300">
      <div className="relative min-h-[5.5rem] bg-sky-200">
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-zinc-800" aria-hidden />
      </div>

      <div className="relative min-h-0 bg-zinc-500">
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          {dividers.map((segment, index) => (
            <line
              key={index}
              x1={segment.x1}
              y1={segment.y1}
              x2={segment.x2}
              y2={segment.y2}
              stroke="#d4d4d8"
              strokeWidth={0.35}
              vectorEffect="non-scaling-stroke"
              strokeDasharray="1.2 1.2"
              strokeDashoffset={dashOffset / 8}
            />
          ))}
        </svg>

        <div
          className="pointer-events-none absolute inset-x-[8%] border-t-2 border-dashed border-zinc-400"
          style={{ top: `${laneY(1)}%` }}
          aria-hidden
        />

        <div
          className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${
            flash === "hit"
              ? "bg-emerald-400/45 opacity-100"
              : flash === "miss"
                ? "bg-red-400/40 opacity-100"
                : "opacity-0"
          }`}
          aria-hidden
        />

        {children}
      </div>
    </div>
  );
}
