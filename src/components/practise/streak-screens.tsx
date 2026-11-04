"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { getLocalActivityDate } from "@/lib/progress/activity-date";

const CSS = `
@keyframes kp-ignite { 0% { clip-path: inset(100% 0 0 0) } 100% { clip-path: inset(0 0 0 0) } }
@keyframes kp-bounce { 0% { transform: scale(.82) } 55% { transform: scale(1.14) } 78% { transform: scale(.97) } 100% { transform: scale(1) } }
@keyframes kp-flicker { 0%,100% { transform: scale(1) skewX(0) } 33% { transform: scale(1.025,.98) skewX(-1.2deg) } 66% { transform: scale(.985,1.025) skewX(1.2deg) } }
@keyframes kp-spark { 0% { opacity: 0; transform: translate(0,0) rotate(45deg) scale(.3) } 25% { opacity: 1 } 100% { opacity: 0; transform: translate(var(--x),var(--y)) rotate(135deg) scale(1) } }
@keyframes kp-fade { to { opacity: 0 } }
@keyframes kp-out { to { opacity: 0; transform: translateY(-55%) } }
@keyframes kp-in { from { opacity: 0; transform: translateY(55%) } to { opacity: 1; transform: translateY(0) } }
@keyframes kp-pop { 0% { transform: scale(.5); opacity: .3 } 60% { transform: scale(1.18); opacity: 1 } 100% { transform: scale(1); opacity: 1 } }
@keyframes kp-rise { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: translateY(0) } }
.kp-flicker { transform-origin: 50% 90%; animation: kp-flicker 2.4s ease-in-out infinite }
@media (prefers-reduced-motion: reduce) { .kp-anim, .kp-flicker { animation-duration: 1ms !important; animation-delay: 0ms !important; animation-iteration-count: 1 !important } }
`;

export function StreakStyles() {
  return <style>{CSS}</style>;
}

const OUTER = "M50 4C58 26 85 41 85 75C85 99 69 116 50 116C31 116 15 99 15 75C15 58 23 47 32 37C34 49 39 54 44 52C50 40 44 20 50 4Z";
const INNER = "M50 52C57 65 71 72 71 89C71 103 62 111 50 111C38 111 29 103 29 89C29 72 43 65 50 52Z";

function FlameShape({ size, outer, inner }: { size: number; outer: string; inner: string }) {
  return (
    <svg aria-hidden="true" width={size} height={size * 1.2} viewBox="0 0 100 120" className="block">
      <path d={OUTER} fill={outer} />
      <path d={INNER} fill={inner} />
    </svg>
  );
}

/** Kidda's own flame. Lit in amber once today's round is done, otherwise grey. */
export function Flame({ lit, size, animate, className }: { lit: boolean; size: number; animate?: boolean; className?: string }) {
  const height = size * 1.2;
  return (
    <span className={`relative block ${className ?? ""}`} style={{ width: size, height }}>
      {animate || !lit ? <span className="kp-anim absolute inset-0" style={lit ? { animation: "kp-fade 200ms linear 950ms both" } : undefined}><FlameShape size={size} outer="#D9D9DE" inner="#EDEDF0" /></span> : null}
      {lit ? (
        <span className={`absolute inset-0 ${animate ? "kp-anim" : ""}`} style={animate ? { animation: "kp-ignite 750ms ease-out 250ms both" } : undefined}>
          <span className="kp-flicker block"><FlameShape size={size} outer="#F59E0B" inner="#FDE68A" /></span>
        </span>
      ) : null}
    </span>
  );
}

function lastSeven(today: string) {
  const [y, m, d] = today.split("-").map(Number);
  return Array.from({ length: 7 }, (_, i) => getLocalActivityDate(new Date(y, m - 1, d - 6 + i)));
}

/** A day is ticked if a round was played then, or it falls inside the current streak. */
export function StreakDays({ today, streak, lit, playedDates, animateToday }: { today: string; streak: number; lit: boolean; playedDates: string[]; animateToday?: boolean }) {
  const days = lastSeven(today);
  const counted = new Set(playedDates);
  const run = Math.max(0, streak);
  days.forEach((d, i) => {
    const fromEnd = lit ? 6 - i : 5 - i;
    if (fromEnd >= 0 && fromEnd < run) counted.add(d);
  });
  return (
    <div className="flex justify-between gap-1.5" role="img" aria-label={`${run} day streak. Last 7 days.`}>
      {days.map((d, i) => {
        const done = counted.has(d) && (d !== today || lit);
        const isToday = d === today;
        return (
          <div key={d} className="flex flex-col items-center gap-1.5">
            <span className={`text-xs font-extrabold ${isToday ? "text-zinc-900" : "text-zinc-500"}`}>{new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { weekday: "narrow" })}</span>
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-full ${done ? "bg-amber-500 text-white kp-anim" : isToday ? "border-2 border-dashed border-amber-400 text-transparent" : "bg-zinc-100 text-transparent"}`}
              style={done && animateToday ? { animation: `kp-pop 420ms ease-out ${isToday ? 1250 : 500 + i * 70}ms both` } : undefined}
            >
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
            </span>
          </div>
        );
      })}
    </div>
  );
}

const SPARKS = [[-92, -64, "#FBBF24"], [86, -78, "#A78BFA"], [-110, 12, "#A78BFA"], [108, 6, "#FBBF24"], [-62, -108, "#FDE68A"], [58, -116, "#F59E0B"], [-84, 62, "#FDE68A"], [88, 56, "#C4B5FD"]] as const;

function NextButton({ title, onClick }: { title: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex h-[60px] w-full items-center justify-center rounded-[18px] bg-violet-600 text-xl font-extrabold text-white shadow-lg shadow-violet-900/25 active:scale-[0.98]">{title}</button>;
}

/** Shown after the first round of the day. The flame lights and the number ticks over. */
export function StreakCelebration({ from, to, today, playedDates, onContinue, playSound }: { from: number; to: number; today: string; playedDates: string[]; onContinue: () => void; playSound: () => void }) {
  useEffect(() => {
    const t = setTimeout(playSound, 450);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const moved = from !== to;
  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <StreakStyles />
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="relative kp-anim" style={{ animation: "kp-bounce 650ms ease-out 700ms both" }}>
          {SPARKS.map(([x, y, c], i) => (
            <span key={i} aria-hidden="true" className="kp-anim absolute left-1/2 top-1/2 h-3.5 w-3.5 rounded-[3px]" style={{ background: c, "--x": `${x}px`, "--y": `${y}px`, animation: `kp-spark 900ms ease-out ${850 + i * 35}ms both` } as CSSProperties} />
          ))}
          <Flame lit size={150} animate />
          <span className="absolute inset-x-0 bottom-[10px] flex h-[76px] items-center justify-center overflow-hidden text-[54px] font-extrabold leading-none text-zinc-900">
            {moved ? <span className="kp-anim absolute" style={{ animation: "kp-out 300ms ease-in 850ms both" }}>{from}</span> : null}
            <span className="kp-anim absolute" style={moved ? { animation: "kp-in 340ms ease-out 1000ms both" } : undefined}>{to}</span>
          </span>
        </div>
        <div className="mt-8 w-full max-w-sm"><StreakDays today={today} streak={to} lit playedDates={playedDates} animateToday /></div>
        <div className="kp-anim mt-7 text-center" style={{ animation: "kp-rise 420ms ease-out 1350ms both" }}>
          <h1 className="text-[28px] font-extrabold tracking-tight text-zinc-900">{to} day streak!</h1>
          <p className="mt-1 text-[15px] font-semibold text-zinc-600">Finish one round every day to build your streak.</p>
        </div>
      </div>
      <NextButton title="Continue" onClick={onContinue} />
    </div>
  );
}

function useCountUp(target: number, delay = 300, duration = 800) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let frame = 0;
    const started = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - started) / duration));
      setValue(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, delay, duration]);
  return value;
}

/** XP counts up and today's bar fills towards the daily goal. */
export function XpProgress({ earned, today, goal }: { earned: number; today: number; goal: number }) {
  const shown = useCountUp(earned);
  const before = Math.min(100, ((today - earned) / goal) * 100);
  const after = Math.min(100, (today / goal) * 100);
  const [width, setWidth] = useState(before);
  useEffect(() => {
    const t = setTimeout(() => setWidth(after), 350);
    return () => clearTimeout(t);
  }, [after]);
  const left = Math.max(0, goal - today);
  return (
    <div>
      {earned > 0 ? <p className="text-center text-[44px] font-extrabold leading-none tracking-tight text-amber-500" aria-label={`Plus ${earned} XP`}>+{shown} XP</p> : null}
      <div className="mt-4 flex items-center gap-2">
        <div className="h-5 flex-1 overflow-hidden rounded-full bg-zinc-200" role="progressbar" aria-valuenow={Math.min(today, goal)} aria-valuemax={goal} aria-label="XP towards today's goal">
          <div className="relative h-full rounded-full bg-amber-400 transition-[width] duration-[900ms] ease-out" style={{ width: `${width}%` }}>
            <span className="absolute inset-x-2 top-1 h-1 rounded-full bg-amber-200" />
          </div>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${left === 0 ? "bg-amber-400" : "bg-zinc-200"}`}>
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill={left === 0 ? "#FFFFFF" : "#9CA3AF"}><path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5-5.9-3.1-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" /></svg>
        </span>
      </div>
      <p className="mt-2 text-center text-[15px] font-semibold text-zinc-600">
        {left === 0 ? "Daily goal reached. Well done!" : `Earn another ${left} XP today to reach your daily goal.`}
      </p>
    </div>
  );
}
