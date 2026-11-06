"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useNativeApp } from "@/lib/native/native-app-context";
import type { HeartsState } from "@/lib/practise/types";

const HEART = "M12 21s-7.5-4.6-9.5-9.4C1.2 8.3 3.4 5 6.8 5c2 0 3.4 1.1 4.2 2.3h2C13.8 6.1 15.2 5 17.2 5c3.4 0 5.6 3.3 4.3 6.6C19.5 16.4 12 21 12 21z";
const RED = "#E8375A";
const EMPTY = "#E4D2D8";

const CSS = `
@keyframes kh-beat{0%,100%{transform:scale(1)}12%{transform:scale(1.18)}24%{transform:scale(1)}}
@keyframes kh-up{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes kh-fade{from{opacity:0}to{opacity:1}}
@keyframes kh-pop{0%{transform:scale(.6);opacity:0}60%{transform:scale(1.08);opacity:1}100%{transform:scale(1);opacity:1}}
@keyframes kh-drain{0%{transform:scale(1);filter:none}40%{transform:scale(1.25)}100%{transform:scale(.9);filter:grayscale(1) opacity(.35)}}
@keyframes kh-crack{0%,40%{opacity:0;transform:translateY(0)}60%{opacity:1}100%{opacity:0;transform:translateY(-40px) scale(.6)}}
@keyframes kh-sway{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
@keyframes kh-z{0%{opacity:0;transform:translate(0,0) scale(.6)}30%{opacity:1}100%{opacity:0;transform:translate(26px,-46px) scale(1.1)}}
@keyframes kh-in{0%{transform:scale(0) rotate(-20deg)}60%{transform:scale(1.25) rotate(6deg)}100%{transform:scale(1) rotate(0)}}
@keyframes kh-spark{0%{opacity:0;transform:translate(0,0) scale(.3)}30%{opacity:1}100%{opacity:0;transform:translate(var(--x),var(--y)) scale(1)}}
@keyframes kh-jump{0%,100%{transform:translateY(0)}40%{transform:translateY(-18px)}60%{transform:translateY(0)}75%{transform:translateY(-6px)}}
@keyframes kh-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
.kh-beat{display:inline-flex;animation:kh-beat 2.4s ease-in-out infinite}
.kh-up{animation:kh-up 420ms cubic-bezier(.2,.9,.25,1) both}
.kh-fade{animation:kh-fade 240ms ease-out both}
.kh-pop{animation:kh-pop 520ms cubic-bezier(.3,1.3,.5,1) 150ms both}
.kh-drain{animation:kh-drain 900ms ease-in-out 700ms both}
.kh-crack{animation:kh-crack 1s ease-out 700ms both}
.kh-sway{transform-origin:50% 100%;animation:kh-sway 4s ease-in-out infinite}
.kh-z{animation:kh-z 2.6s ease-out infinite}
.kh-in{display:inline-flex;animation:kh-in 520ms cubic-bezier(.3,1.4,.5,1) both}
.kh-spark{position:absolute;left:50%;top:50%;width:10px;height:10px;border-radius:3px;animation:kh-spark 800ms ease-out both}
.kh-jump{animation:kh-jump 1.2s ease-in-out 1.4s 2}
.kh-rise{animation:kh-rise 420ms ease-out 1.3s both}
@media (prefers-reduced-motion:reduce){.kh-beat,.kh-up,.kh-fade,.kh-pop,.kh-drain,.kh-crack,.kh-sway,.kh-z,.kh-in,.kh-spark,.kh-jump,.kh-rise{animation-duration:1ms!important;animation-delay:0ms!important;animation-iteration-count:1!important}}
`;

const CHARACTERS = {
  haathi: "/characters/haathi.webp",
  billi: "/characters/billi.webp",
};

function Heart({ size, fill = RED, className, style }: { size: number; fill?: string; className?: string; style?: React.CSSProperties }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" className={className} style={style}><path d={HEART} fill={fill} /></svg>;
}

/** Re-renders every second while counting down to `iso`. */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [active]);
  return now;
}

function msUntil(iso: string | null, now: number) {
  return iso ? Math.max(0, new Date(iso).getTime() - now) : 0;
}

function hoursMinutes(ms: number) {
  const m = Math.ceil(ms / 60000);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

function clock(ms: number) {
  const s = Math.ceil(ms / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

function timeOfDay(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const time = d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `${time} today`;
  if (d.toDateString() === tomorrow.toDateString()) return `${time} tomorrow`;
  return `${time} ${d.toLocaleDateString("en-GB", { weekday: "long" })}`;
}

export function HeartsStyles() {
  return <style>{CSS}</style>;
}

/** The three hearts in the corner of the Practice scene. */
export function HeartsPill({ state, onOpen }: { state: HeartsState; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} aria-label={`${state.hearts} of 3 hearts. How hearts work`} className="flex h-11 items-center gap-1 rounded-full bg-white/95 px-3 lg:h-12">
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < state.hearts ? "kh-beat" : "inline-flex"} style={i < state.hearts ? { animationDelay: `${i * 0.15}s` } : undefined}>
          <Heart size={22} fill={i < state.hearts ? RED : EMPTY} />
        </span>
      ))}
    </button>
  );
}

/** Premium and Community members: unlimited hearts, shown as a heart and an infinity sign. */
export function UnlimitedHeartsPill() {
  return (
    <span
      role="img"
      aria-label="Unlimited hearts with Premium"
      title="Unlimited hearts with Premium"
      className="flex h-11 items-center gap-1.5 rounded-full bg-white/95 px-3 lg:h-12"
    >
      <span className="kh-beat">
        <Heart size={22} />
      </span>
      <span className="text-xl font-extrabold leading-none text-zinc-900">∞</span>
    </span>
  );
}

/** Bottom sheet that explains hearts, opened from the pill. */
export function HeartsSheet({ state, onClose }: { state: HeartsState; onClose: () => void }) {
  const now = useNow(state.hearts < 3);
  const left = msUntil(state.nextHeartAt, now);
  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Close" onClick={onClose} className="kh-fade absolute inset-0 h-full w-full bg-zinc-900/45" />
      <div role="dialog" aria-label="Your hearts" className="kh-up absolute inset-x-0 bottom-0 mx-auto flex max-w-md flex-col gap-[18px] rounded-t-[28px] bg-white px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-3">
        <span className="h-[5px] w-11 self-center rounded-full bg-zinc-200" />
        <div className="text-center">
          <h2 className="text-2xl font-extrabold text-zinc-900">Your hearts</h2>
          <p className="mt-1 text-base text-zinc-600">{state.hearts < 3 && state.nextHeartAt ? <>Next heart in <b className="tabular-nums text-zinc-900">{hoursMinutes(left)}</b></> : "Your hearts are full"}</p>
        </div>
        <div className="flex justify-center gap-[18px]">
          {[0, 1, 2].map((i) => <Heart key={i} size={64} fill={i < state.hearts ? RED : EMPTY} />)}
        </div>
        <div className="flex flex-col gap-3 rounded-[20px] bg-violet-50/70 p-4 text-[15px] leading-snug text-zinc-800">
          <span><b>Each Play uses 1 heart.</b> Mistakes never cost you one.</span>
          <span><b>A heart comes back every 8 hours,</b> up to 3.</span>
          <span><b>Course practice is always free to play.</b> No hearts needed.</span>
        </div>
        <button type="button" onClick={onClose} className="h-14 rounded-[18px] bg-violet-600 text-lg font-extrabold text-white shadow-[0_4px_0_#5B21B6]">Got it</button>
      </div>
    </div>
  );
}

/** After a Play: the heart that was used drains away, and the learner sees what's left. */
export function HeartsAfter({ state, onPlay, onLater, busy }: { state: HeartsState; onPlay: () => void; onLater: () => void; busy: boolean }) {
  const left = state.hearts;
  return (
    <div className="fixed inset-0 z-40 bg-white">
      <div className="mx-auto flex h-full max-w-md flex-col px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(4rem,env(safe-area-inset-top))]">
        <div className="flex flex-1 flex-col items-center justify-center gap-7 text-center">
          <p className="kh-pop text-[15px] font-extrabold uppercase tracking-wider text-violet-700">Play complete</p>
          <div className="flex items-center gap-4">
            {[0, 1, 2].map((i) => {
              if (i < left) return <Heart key={i} size={58} />;
              if (i === left) return (
                <span key={i} className="relative inline-flex">
                  <Heart size={58} className="kh-drain" />
                  <Heart size={26} className="kh-crack absolute left-4 top-0" />
                </span>
              );
              return <Heart key={i} size={58} style={{ filter: "grayscale(1) opacity(.35)" }} />;
            })}
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-zinc-900">{left === 1 ? "1 heart left" : `${left} hearts left`}</h1>
            <p className="mt-1 text-base text-zinc-600">{left === 1 ? "Your last Play for now. Make it count." : "Keep the run going."}</p>
          </div>
        </div>
        <button type="button" disabled={busy} onClick={onPlay} className="flex h-[58px] items-center justify-center gap-2 rounded-[18px] bg-violet-600 text-lg font-extrabold text-white shadow-[0_4px_0_#5B21B6] disabled:opacity-60">
          {busy ? "Loading…" : <>Play again <Heart size={18} fill="#FFFFFF" /> 1</>}
        </button>
        <button type="button" onClick={onLater} className="mt-1.5 h-12 text-base font-bold text-violet-700">Save it for later</button>
      </div>
    </div>
  );
}

/** No hearts left: a calm wait with a live countdown. */
export function HeartsOut({ state, onClose }: { state: HeartsState; onClose: () => void }) {
  const native = useNativeApp();
  const now = useNow(true);
  const left = msUntil(state.nextHeartAt, now);
  return (
    <div className="fixed inset-0 z-40 bg-violet-50">
      <div className="mx-auto flex h-full max-w-md flex-col px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(3.5rem,env(safe-area-inset-top))]">
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
          <div className="relative w-[150px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="kh-sway block h-auto w-[150px]" src={CHARACTERS.haathi} alt="Haathi the elephant" />
            <span aria-hidden="true" className="kh-z absolute right-1.5 top-1 text-[22px] font-extrabold text-violet-400">z</span>
            <span aria-hidden="true" className="kh-z absolute right-[18px] top-[18px] text-base font-extrabold text-violet-300" style={{ animationDelay: "1.3s" }}>z</span>
          </div>
          <div>
            <h1 className="text-[28px] font-extrabold text-zinc-900">Hearts recharging</h1>
            <p className="mt-1 text-base text-zinc-600">Great work today. Your next Play is on its way.</p>
          </div>
          <div className="flex gap-3.5">{[0, 1, 2].map((i) => <Heart key={i} size={28} fill={EMPTY} />)}</div>
          <div className="flex flex-col gap-0.5 rounded-[22px] bg-white px-6 py-4 shadow-[0_2px_0_#E9E2F8]">
            <span className="text-[13px] font-extrabold uppercase tracking-wider text-zinc-500">Next heart in</span>
            <span className="text-[40px] font-extrabold tabular-nums text-[#E8375A]">{clock(left)}</span>
            {state.fullAt ? <span className="text-sm text-zinc-600">All 3 back by {timeOfDay(state.fullAt)}</span> : null}
          </div>
        </div>
        <Link href="/dashboard/learn" className="flex h-[58px] items-center justify-center rounded-[18px] bg-green-700 text-[17px] font-extrabold text-white shadow-[0_4px_0_#14532D]">Keep going with course practice</Link>
        {native ? null : (
          <Link href="/dashboard/membership/premium" className="mt-2 flex h-[52px] items-center justify-center gap-2 rounded-[18px] border-2 border-violet-200 bg-white text-base font-extrabold text-violet-700">
            <Heart size={18} fill="#7C3AED" />Unlimited hearts with Premium
          </Link>
        )}
        <button type="button" onClick={onClose} className="mt-1 h-11 text-sm font-bold text-zinc-500">Back to Practice</button>
      </div>
    </div>
  );
}

const SPARKS: [string, string, string][] = [["#FFCD40", "-34px", "-30px"], ["#E8375A", "30px", "-36px"]];

/** Shown once when the learner comes back to full hearts. */
export function HeartsBack({ onPlay, onClose }: { onPlay: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 bg-[#FFF7F9]">
      <div className="mx-auto flex h-full max-w-md flex-col px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(3.5rem,env(safe-area-inset-top))]">
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="kh-jump h-auto w-[140px]" src={CHARACTERS.billi} alt="Billi the kitten" />
          <div className="flex gap-4">
            {[0, 1, 2].map((i) => (
              <span key={i} className="relative inline-flex">
                <span className="kh-in" style={{ animationDelay: `${0.4 + i * 0.3}s` }}><Heart size={60} /></span>
                {SPARKS.map(([c, x, y], j) => <span key={j} aria-hidden="true" className="kh-spark" style={{ background: c, "--x": x, "--y": y, animationDelay: `${0.6 + i * 0.3}s` } as React.CSSProperties} />)}
              </span>
            ))}
          </div>
          <div className="kh-rise">
            <h1 className="text-[30px] font-extrabold text-zinc-900">Your hearts are back!</h1>
            <p className="mt-1 text-base text-zinc-600">3 Plays ready.</p>
          </div>
        </div>
        <button type="button" onClick={onPlay} className="kh-rise h-[58px] rounded-[18px] bg-violet-600 text-lg font-extrabold text-white shadow-[0_4px_0_#5B21B6]">Play</button>
        <button type="button" onClick={onClose} className="mt-1 h-11 text-sm font-bold text-zinc-500">Not now</button>
      </div>
    </div>
  );
}
