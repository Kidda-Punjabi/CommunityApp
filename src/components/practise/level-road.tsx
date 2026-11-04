"use client";

import { useEffect, useRef, useState } from "react";
import { LEVELS } from "@/lib/practise/levels";
import { ArenaArt } from "./arena-art";

const STEP = 178;
const WIDTH = 340;
const TOP = 96;
const X = [82, 258];

function scrollParent(node: HTMLElement): HTMLElement | null {
  let parent = node.parentElement;
  while (parent) {
    const o = getComputedStyle(parent).overflowY;
    if ((o === "auto" || o === "scroll") && parent.scrollHeight > parent.clientHeight) return parent;
    parent = parent.parentElement;
  }
  return null;
}

export function LevelRoad({ current, disabled, onPick }: { current: number; disabled?: boolean; onPick: (level: number) => void }) {
  const road = [...LEVELS].reverse();
  const point = (i: number) => ({ x: X[(road[i].level + 1) % 2], y: TOP + i * STEP });
  const height = TOP + (road.length - 1) * STEP + 130;
  const youRef = useRef<HTMLButtonElement>(null);
  const [reached, setReached] = useState<number>(-1);

  // Starts at Level 0 and climbs slowly to where you are, each passed level breathing as you go by.
  useEffect(() => {
    const you = youRef.current;
    if (!you) return;
    const scroller = scrollParent(you);
    const viewH = scroller ? scroller.clientHeight : window.innerHeight;
    const maxTop = scroller ? scroller.scrollHeight - viewH : document.documentElement.scrollHeight - viewH;
    const originTop = scroller ? scroller.getBoundingClientRect().top - scroller.scrollTop : -window.scrollY;
    const youY = you.getBoundingClientRect().top + you.offsetHeight / 2 - originTop;
    const target = Math.max(0, Math.min(maxTop, youY - viewH / 2));
    const set = (y: number) => { if (scroller) scroller.scrollTop = y; else window.scrollTo(0, y); };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      set(target);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReached(current);
      return;
    }

    const distance = maxTop - target;
    const duration = Math.min(4200, Math.max(1100, 1100 + distance * 1.5));
    let frame = 0;
    let cancelled = false;
    const cancel = () => { cancelled = true; };
    window.addEventListener("wheel", cancel, { passive: true, once: true });
    window.addEventListener("touchstart", cancel, { passive: true, once: true });
    set(maxTop);
    let start = 0;
    const tick = (now: number) => {
      if (cancelled) { setReached(current); return; }
      start ||= now;
      const t = Math.min(1, (now - start) / duration);
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      set(maxTop - distance * eased);
      setReached(Math.round(current * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchstart", cancel);
    };
  }, [current]);

  return (
    <div className="relative mx-auto" style={{ width: WIDTH, height }}>
      <style>{`
        @keyframes practise-breathe { 0%,100% { transform: scale(1) } 50% { transform: scale(1.05) } }
        @keyframes practise-pass { 0% { transform: scale(1) } 45% { transform: scale(1.14) } 100% { transform: scale(1) } }
        @media (prefers-reduced-motion: reduce) { .practise-node { animation: none !important } }
      `}</style>
      <svg aria-hidden="true" width={WIDTH} height={height} className="absolute inset-0">
        {road.slice(0, -1).map((l, i) => {
          const a = point(i), b = point(i + 1);
          const d = `M${a.x} ${a.y} C${a.x} ${a.y + STEP * 0.55} ${b.x} ${b.y - STEP * 0.55} ${b.x} ${b.y}`;
          const walked = l.level <= current;
          return (
            <g key={l.level}>
              <path d={d} fill="none" stroke={walked ? "#8B5CF6" : "#DDD5EE"} strokeWidth="22" strokeLinecap="round" />
              <path d={d} fill="none" stroke={walked ? "#EDE5FF" : "#FFFFFF"} strokeWidth="3" strokeLinecap="round" strokeDasharray="12 14" />
            </g>
          );
        })}
      </svg>
      {road.map((l, i) => {
        const p = point(i);
        const you = l.level === current;
        const passed = l.level < current;
        const size = you ? 128 : 104;
        const onLeft = p.x < WIDTH / 2;
        const newStage = l.stage !== road[i - 1]?.stage;
        return (
          <div key={l.level}>
            {newStage ? (
              <p className="absolute rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-widest text-violet-900" style={{ top: p.y - 92, [onLeft ? "right" : "left"]: 0 }}>{l.stage}</p>
            ) : null}
            <button
              ref={you ? youRef : undefined}
              id={`practise-level-${l.level}`}
              type="button"
              disabled={disabled}
              onClick={() => onPick(l.level)}
              aria-label={`Level ${l.level}, ${l.name}. ${you ? "You are here" : passed ? "Passed" : "Locked"}`}
              className="practise-node absolute overflow-hidden rounded-full bg-white"
              style={{
                left: p.x - size / 2,
                top: p.y - size / 2,
                width: size,
                height: size,
                boxShadow: you ? "0 0 0 5px #7C3AED, 0 0 0 11px rgba(124,58,237,0.2), 0 14px 26px -10px rgba(76,29,149,0.6)" : passed ? "0 0 0 4px #8B5CF6, 0 8px 16px -8px rgba(76,29,149,0.45)" : "0 0 0 4px #DDD5EE",
                animation: you ? "practise-breathe 2.6s ease-in-out infinite" : passed && reached >= l.level ? "practise-pass 700ms ease-out" : undefined,
              }}
            >
              <span className={`block h-full w-full ${!you && !passed ? "opacity-55 grayscale" : ""}`}><ArenaArt level={l.level} /></span>
            </button>
            <span className={`pointer-events-none absolute flex h-8 min-w-8 items-center justify-center rounded-full px-1.5 text-sm font-extrabold ${passed ? "bg-green-700 text-white" : you ? "bg-violet-700 text-white" : "bg-zinc-200 text-zinc-700"}`} style={{ left: p.x + size * 0.28, top: p.y - size / 2 - 2 }}>
              {passed ? <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg> : l.level}
            </span>
            <div className="pointer-events-none absolute w-[128px]" style={{ top: p.y - 26, [onLeft ? "left" : "right"]: onLeft ? p.x + size / 2 + 16 : WIDTH - p.x + size / 2 + 16, textAlign: onLeft ? "left" : "right" }}>
              <p className="text-[12px] font-extrabold text-zinc-600">Level {l.level}</p>
              <p className={`font-extrabold leading-tight text-zinc-900 ${you ? "text-lg" : "text-base"}`}>{l.name}</p>
              <p lang="pa" className="text-sm font-bold text-violet-700">{l.gurmukhi}</p>
              {you ? <p className="mt-0.5 text-xs font-extrabold text-violet-800">You are here</p> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
