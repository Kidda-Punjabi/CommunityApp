"use client";

import { useEffect, useRef } from "react";
import {
  DASH_CYCLE_PX,
  DASH_SCROLL_SPEED,
  ROAD_DIVIDER_ROTATE_DEG,
} from "@/lib/games/lane-runner/config";

type LaneRunnerRoadProps = {
  flash: "hit" | "miss" | null;
  children: React.ReactNode;
};

function DashStrip({ stripRef }: { stripRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <div ref={stripRef} className="flex flex-col items-stretch">
        {Array.from({ length: 24 }).map((_, index) => (
          <div
            key={index}
            className="mx-auto mb-2 h-3 w-1 shrink-0 bg-amber-100"
          />
        ))}
      </div>
    </div>
  );
}

export function LaneRunnerRoad({ flash, children }: LaneRunnerRoadProps) {
  const stripLeftRef = useRef<HTMLDivElement>(null);
  const stripRightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let offset = 0;
    let raf = 0;

    const tick = () => {
      offset += DASH_SCROLL_SPEED;
      if (offset >= DASH_CYCLE_PX) offset -= DASH_CYCLE_PX;
      const transform = `translateY(${offset}px)`;
      if (stripLeftRef.current) stripLeftRef.current.style.transform = transform;
      if (stripRightRef.current) stripRightRef.current.style.transform = transform;
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="relative flex min-h-[22rem] flex-1 flex-col overflow-hidden rounded-xl border border-zinc-200">
      <div className="relative h-[28%] shrink-0 bg-violet-100">
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-zinc-700" aria-hidden />
      </div>

      <div className="relative flex-1 bg-zinc-500">
        <div
          className="pointer-events-none absolute bottom-0 left-1/3 top-0 w-0.5 origin-bottom bg-zinc-300"
          style={{ transform: `translateX(-50%) rotate(-${ROAD_DIVIDER_ROTATE_DEG}deg)` }}
        >
          <DashStrip stripRef={stripLeftRef} />
        </div>
        <div
          className="pointer-events-none absolute bottom-0 left-2/3 top-0 w-0.5 origin-bottom bg-zinc-300"
          style={{ transform: `translateX(-50%) rotate(${ROAD_DIVIDER_ROTATE_DEG}deg)` }}
        >
          <DashStrip stripRef={stripRightRef} />
        </div>

        <div
          className="pointer-events-none absolute inset-x-[8%] border-t-2 border-dashed border-zinc-400"
          style={{ top: "78%" }}
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
