"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { getStreakPresentation } from "@/app/dashboard/home/streak-actions";
import { getLevelPreview, startLevelCheck, startRound, submitLevelCheck, submitRound } from "@/app/dashboard/home/practise-actions";
import { getLocalActivityDate } from "@/lib/progress/activity-date";
import { LEVELS } from "@/lib/practise/levels";
import { usePractiseSound } from "@/lib/practise/sounds";
import type { CheckQuestion, CheckResult, LevelPreview, PractiseHome, PractiseSkill, RoundAnswer, RoundQuestion, RoundResult, SkillSummary } from "@/lib/practise/types";
import { ArenaArt } from "./arena-art";
import { AudioButton, RoundPlayer } from "./round-player";

const ICONS: Record<PractiseSkill, ReactNode> = {
  words: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5M9 8h6M9 12h6" /></>,
  grammar: <><rect x="3" y="14" width="8" height="7" rx="1" /><rect x="13" y="14" width="8" height="7" rx="1" /><rect x="8" y="4" width="8" height="7" rx="1" /></>,
  listening: <><path d="M4 15v-3a8 8 0 0 1 16 0v3" /><rect x="2.5" y="14" width="5" height="7" rx="1.5" /><rect x="16.5" y="14" width="5" height="7" rx="1.5" /></>,
  speaking: <><rect x="9" y="2.5" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5" /></>,
};

function Icon({ skill, size = 22 }: { skill: PractiseSkill; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{ICONS[skill]}</svg>;
}

function Ring({ pct, skill, size = 58, tone = "normal" }: { pct: number; skill: PractiseSkill; size?: number; tone?: "normal" | "weak" | "full" }) {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  const col = { weak: "#C2410C", full: "#15803D", normal: "#7C3AED" }[tone];
  const bg = { weak: "#FDE7D8", full: "#DCF3E3", normal: "#EDE5FF" }[tone];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size, color: col }}>
      <svg aria-hidden="true" width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={bg} strokeWidth="7" />
        {pct > 0 ? <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(c * Math.min(pct, 100)) / 100} ${c}`} className="transition-all duration-700" /> : null}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center"><Icon skill={skill} size={Math.round(size * 0.36)} /></div>
    </div>
  );
}

function BigButton({ title, sub, onClick, gold, disabled }: { title: string; sub?: string; onClick: () => void; gold?: boolean; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`flex h-[72px] w-full flex-col items-center justify-center rounded-[20px] px-4 shadow-lg shadow-violet-900/25 transition active:scale-[0.98] disabled:opacity-60 ${gold ? "bg-amber-400 text-zinc-900" : "bg-violet-600 text-white"}`}>
      <span className="text-2xl font-extrabold leading-tight">{title}</span>
      {sub ? <span className="max-w-full truncate text-[13px] font-bold opacity-90">{sub}</span> : null}
    </button>
  );
}

function Back({ onClick, label = "Back" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-zinc-900">
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m15 5-7 7 7 7" /></svg>
    </button>
  );
}

function Tick({ state }: { state: "done" | "focus" | "todo" }) {
  if (state === "done") return <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-700 text-white"><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg></span>;
  if (state === "focus") return <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-700 text-white"><svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z" /></svg></span>;
  return <span className="mx-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-zinc-300" />;
}

function Stars({ n }: { n: number }) {
  return <span className="mt-0.5 flex gap-px" role="img" aria-label={`${n} of 3 stars`}>{[0, 1, 2].map((i) => <svg key={i} aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill={i < n ? "#F59E0B" : "#E5E7EB"}><path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5-5.9-3.1-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" /></svg>)}</span>;
}

function useStreak() {
  const [streak, setStreak] = useState<{ count: number; today: string } | null>(null);
  useEffect(() => {
    const today = getLocalActivityDate();
    void getStreakPresentation(today).then((s) => { if (s && !("error" in s)) setStreak({ count: s.streak, today }); }).catch(() => undefined);
  }, []);
  return streak;
}

function lastSevenDays(today: string) {
  const [y, m, d] = today.split("-").map(Number);
  return Array.from({ length: 7 }, (_, i) => getLocalActivityDate(new Date(y, m - 1, d - 6 + i)));
}

function StreakCard({ home, count, today }: { home: PractiseHome; count: number; today: string }) {
  const played = home.playedDates.includes(today);
  const days = lastSevenDays(today);
  return (
    <div className={`mt-3 flex items-center gap-3 rounded-2xl px-3 py-2.5 ${played ? "bg-green-50" : "bg-amber-50"}`}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold text-zinc-900">{count > 0 ? `${count} day streak` : "Start a streak"}</p>
        <p className="text-xs font-semibold text-zinc-600">{played ? "Safe for today. Back tomorrow." : count > 0 ? "Finish one round today to keep it." : "Finish one round today."}</p>
      </div>
      <div className="flex gap-1" role="img" aria-label="Rounds played in the last 7 days">
        {days.map((d) => (
          <span key={d} className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-extrabold ${home.playedDates.includes(d) ? "bg-amber-400 text-zinc-900" : d === today ? "border-2 border-amber-400 text-zinc-700" : "bg-white text-zinc-500"}`}>
            {new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { weekday: "narrow" })}
          </span>
        ))}
      </div>
    </div>
  );
}

type View =
  | { name: "home" } | { name: "checklist" } | { name: "skill"; skill: PractiseSkill } | { name: "road" }
  | { name: "preview"; data: LevelPreview } | { name: "round"; skill: PractiseSkill; questions: RoundQuestion[] }
  | { name: "result"; skill: PractiseSkill; result: RoundResult } | { name: "check" }
  | { name: "checkRun"; checkId: string; questions: CheckQuestion[] } | { name: "checkResult"; result: CheckResult } | { name: "levelUp" };

export function PractiseApp({ home }: { home: PractiseHome }) {
  const router = useRouter();
  const sound = usePractiseSound();
  const streak = useStreak();
  const [view, setView] = useState<View>(home.levelUpFrom != null ? { name: "levelUp" } : { name: "home" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { meta, skills, weakest } = home;
  const weak = skills.find((s) => s.skill === weakest) ?? null;
  const nextLevel = meta.level < 9 ? meta.level + 1 : null;

  useEffect(() => { if (view.name === "levelUp") sound("levelUp"); /* once on arrival */ }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { window.scrollTo({ top: 0 }); }, [view.name]);

  const go = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await fn(); } catch { setError("That didn't work. Please try again."); } finally { setBusy(false); }
  };
  const play = (skill: PractiseSkill) => go(async () => {
    sound("tap");
    const questions = await startRound(skill);
    setView({ name: "round", skill, questions });
  });
  const finishRound = (skill: PractiseSkill, answers: RoundAnswer[]) => go(async () => {
    const result = await submitRound(skill, answers, getLocalActivityDate());
    setView({ name: "result", skill, result });
    sound("finish");
    if (result.streakExtended) setTimeout(() => sound("streak"), 750);
    router.refresh();
  });

  const shell = "mx-auto w-full max-w-md px-4 pb-6 pt-3";
  const errorNote = error ? <p role="alert" className="mt-2 text-center text-sm font-semibold text-orange-800">{error}</p> : null;

  if (view.name === "round") return <RoundPlayer questions={view.questions} onLeave={() => setView({ name: "home" })} onFinish={(a) => void finishRound(view.skill, a)} />;

  if (view.name === "result") {
    const r = view.result;
    const after = skills.find((s) => s.skill === view.skill);
    return (
      <div className={shell}>
        <div className="h-40 overflow-hidden rounded-3xl"><ArenaArt level={meta.level} /></div>
        <p className="mt-5 text-center text-4xl font-extrabold tracking-tight text-zinc-900">{r.correct} of {r.total}</p>
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-violet-50 p-3">
          <Ring pct={r.skillPctAfter} skill={view.skill} size={50} />
          <div><p className="text-[15px] font-extrabold text-zinc-900">{after?.label}</p><p className="text-sm font-bold text-zinc-700">{r.skillPctBefore === r.skillPctAfter ? `${r.skillPctAfter}%` : `${r.skillPctBefore}% to ${r.skillPctAfter}%`}</p></div>
        </div>
        {r.ticked.length ? (
          <div className="mt-3 rounded-2xl bg-green-50 p-3">
            <p className="text-xs font-extrabold tracking-wide text-green-800">TICKED OFF YOUR CHECKLIST</p>
            <p className="mt-1 text-[15px] font-bold text-zinc-900">{r.ticked.slice(0, 4).join(", ")}{r.ticked.length > 4 ? ` and ${r.ticked.length - 4} more` : ""}</p>
          </div>
        ) : null}
        {r.streak != null ? (
          <div className="mt-3 rounded-2xl bg-amber-50 p-3 text-center">
            <p className="text-lg font-extrabold text-zinc-900">{r.streak} day streak</p>
            <p className="text-sm font-semibold text-zinc-700">{r.streakExtended ? "Today counts. See you tomorrow." : "Already safe for today."}</p>
          </div>
        ) : null}
        <div className="mt-5"><BigButton title="Play again" sub={after ? `${after.label}: ${after.focus}` : undefined} disabled={busy} onClick={() => void play(view.skill)} /></div>
        <button type="button" onClick={() => setView({ name: "home" })} className="mt-2 min-h-11 w-full text-[15px] font-extrabold text-violet-700">Done for today</button>
        {errorNote}
      </div>
    );
  }

  if (view.name === "levelUp") {
    return (
      <div className={shell}>
        <div className="h-72 overflow-hidden rounded-3xl"><ArenaArt level={meta.level} /></div>
        <div className="mt-5 text-center">
          <p className="text-[13px] font-extrabold tracking-widest text-violet-700">YOU PASSED</p>
          <h1 className="mt-1 text-[40px] font-extrabold leading-none tracking-tight text-zinc-900">Level {meta.level}</h1>
          <p className="mt-1 text-2xl font-extrabold text-zinc-900">{meta.name} <span lang="pa" className="text-xl text-violet-700">{meta.gurmukhi}</span></p>
          <p className="mt-2 text-[15px] font-semibold text-zinc-700">“{meta.can}”</p>
        </div>
        <div className="mt-6"><BigButton title={`Enter ${meta.name}`} sub="Your new checklist is ready" onClick={() => setView({ name: "home" })} /></div>
      </div>
    );
  }

  if (view.name === "road") {
    const road = [...LEVELS].reverse();
    return (
      <div className={shell}>
        <div className="mb-2 flex items-center gap-1"><Back onClick={() => setView({ name: "home" })} /><h1 className="text-xl font-extrabold text-zinc-900">Your road</h1></div>
        <div className="flex flex-col gap-2.5">
          {road.map((l, i) => {
            const you = l.level === meta.level, passed = l.level < meta.level;
            const head = l.stage !== road[i - 1]?.stage ? l.stage : null;
            return (
              <div key={l.level}>
                {head ? <p className="mx-1 mb-2 mt-3 text-[13px] font-extrabold uppercase tracking-wide text-violet-900">{head}</p> : null}
                <button type="button" disabled={busy} onClick={() => you ? setView({ name: "checklist" }) : void go(async () => setView({ name: "preview", data: await getLevelPreview(l.level) }))} className={`block w-full overflow-hidden rounded-[20px] bg-white text-left ${you ? "border-[3px] border-violet-600" : "border border-zinc-200"}`}>
                  <div className={`relative overflow-hidden ${you ? "h-36" : "h-28"}`}>
                    <div className={`h-full ${!you && !passed ? "opacity-60 grayscale-[.75]" : ""}`}><ArenaArt level={l.level} /></div>
                    <span className="absolute right-2.5 top-2.5">{you ? <span className="rounded-full bg-violet-600 px-2.5 py-1 text-xs font-extrabold text-white">You are here</span> : passed ? <Tick state="done" /> : <span className="rounded-full bg-white/95 px-2.5 py-1 text-xs font-extrabold text-zinc-700">Locked</span>}</span>
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="flex items-baseline gap-1.5"><span className="text-[13px] font-extrabold text-zinc-600">Level {l.level}</span><span className="text-lg font-extrabold text-zinc-900">{l.name}</span><span lang="pa" className="text-[15px] font-bold text-violet-700">{l.gurmukhi}</span></p>
                    <p className="text-[13px] font-semibold text-zinc-700">{l.can}</p>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
        {errorNote}
      </div>
    );
  }

  if (view.name === "preview") {
    const p = view.data;
    return (
      <div className={shell}>
        <div className="relative h-32 overflow-hidden rounded-3xl"><ArenaArt level={p.meta.level} /><div className="absolute left-3 top-3"><Back onClick={() => setView({ name: "road" })} /></div></div>
        <h1 className="mt-4 text-[26px] font-extrabold tracking-tight text-zinc-900">Level {p.meta.level} · {p.meta.name}</h1>
        <p className="text-sm font-semibold text-zinc-700">“{p.meta.can}”</p>
        <p className={`mt-3 rounded-2xl p-3 text-sm font-extrabold ${p.state === "passed" ? "bg-green-50 text-green-800" : "bg-zinc-100 text-zinc-700"}`}>{p.state === "passed" ? "Passed" : `Opens after Level ${p.meta.level - 1}`}</p>
        {p.skills.map((s) => (
          <section key={s.label} className="mt-3 rounded-[18px] border border-zinc-200 p-3.5">
            <h2 className="text-[15px] font-extrabold text-zinc-900">{s.label}</h2>
            <ul className="mt-2 flex flex-col gap-2">{s.rows.map((r) => <li key={r} className="flex items-start gap-2.5 text-sm font-semibold text-zinc-800"><Tick state={p.state === "passed" ? "done" : "todo"} />{r}</li>)}</ul>
          </section>
        ))}
      </div>
    );
  }

  if (view.name === "check") {
    const allPassed = home.checkParts.every((p) => p.passed);
    return (
      <div className={shell}>
        <Back onClick={() => setView({ name: "home" })} />
        <p className="mt-1 text-sm font-bold text-zinc-600">{nextLevel != null ? `Level ${meta.level} to Level ${nextLevel}` : "The final check"}</p>
        <h1 className="text-[32px] font-extrabold tracking-tight text-zinc-900">Level Check</h1>
        <p className="text-[15px] font-semibold text-zinc-700">Confidence is never scored.</p>
        <div className="mt-4 flex flex-col gap-2.5">
          {home.checkParts.map((p, i) => (
            <div key={p.part} className="rounded-[18px] border border-zinc-200 p-3.5">
              <div className="flex items-start gap-3">
                {p.passed ? <Tick state="done" /> : null}
                <div className="min-w-0 flex-1">
                  <p className="text-base font-extrabold text-zinc-900">{i + 1}. {p.label}</p>
                  <p className="text-[13px] font-semibold text-zinc-700">{p.detail}</p>
                  <p className="mt-1 text-[13px] font-extrabold text-violet-800">{p.passed ? `Passed, ${p.lastScore}` : p.passLabel}</p>
                  {p.lockedUntil ? <p className="mt-1 text-[13px] font-bold text-orange-800">Last score {p.lastScore}. Opens {new Date(p.lockedUntil).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.</p> : null}
                </div>
              </div>
              {!p.passed && !p.lockedUntil ? <button type="button" disabled={busy} onClick={() => void go(async () => { const c = await startLevelCheck(p.part); setView({ name: "checkRun", ...c }); })} className="mt-3 h-12 w-full rounded-2xl bg-amber-400 font-extrabold text-zinc-900 disabled:opacity-60">Start</button> : null}
            </div>
          ))}
          <div className={`rounded-[18px] border p-3.5 ${allPassed || meta.level === 9 ? "border-violet-300 bg-violet-50" : "border-zinc-200"}`}>
            <p className="text-base font-extrabold text-zinc-900">{home.checkParts.length + 1}. {meta.level === 0 ? "Voice note" : "Speaking test"}, with your tutor</p>
            <p className="text-[13px] font-semibold text-zinc-700">{meta.speakingTest}</p>
            <p className="mt-1 text-[13px] font-extrabold text-violet-800">{allPassed || meta.level === 9 ? "Ready. Tell your tutor you're ready for this part. They'll move you up when you pass." : meta.level === 0 ? "Opens after the sound check" : "Pass: 3.5 average. Opens after the parts above."}</p>
          </div>
        </div>
        {errorNote}
      </div>
    );
  }

  if (view.name === "checkRun") {
    return <CheckRunner questions={view.questions} onLeave={() => setView({ name: "check" })} onDone={(picks) => void go(async () => {
      const result = await submitLevelCheck(view.checkId, picks);
      sound(result.passed ? "finish" : "wrong");
      setView({ name: "checkResult", result });
      router.refresh();
    })} />;
  }

  if (view.name === "checkResult") {
    const r = view.result;
    return (
      <div className={shell}>
        <div className="h-44 overflow-hidden rounded-3xl"><ArenaArt level={meta.level} /></div>
        <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-zinc-900">{r.passed ? "Passed!" : "So close"}</h1>
        <p className="mt-1 text-2xl font-extrabold text-violet-800">{r.score} of {r.total}</p>
        <p className="mt-2 text-[15px] font-semibold leading-snug text-zinc-700">{r.message}</p>
        <div className="mt-6"><BigButton title="Back to Level Check" onClick={() => setView({ name: "check" })} /></div>
      </div>
    );
  }

  if (view.name === "skill" || view.name === "checklist") {
    const list: SkillSummary[] = view.name === "skill"
      ? skills.filter((s) => s.skill === view.skill)
      : [...skills].sort((a, b) => (a.skill === weakest ? -1 : b.skill === weakest ? 1 : 0));
    const target = view.name === "skill" ? list[0] : weak;
    return (
      <div className={`${shell} pb-2`}>
        <div className="relative h-24 overflow-hidden rounded-3xl"><ArenaArt level={meta.level} /><div className="absolute left-2 top-2"><Back onClick={() => setView({ name: "home" })} /></div></div>
        <p className="mt-3 text-[13px] font-bold text-zinc-600">Level {meta.level} · {meta.name}</p>
        <h1 className="text-[26px] font-extrabold tracking-tight text-zinc-900">{view.name === "skill" ? list[0].label : nextLevel != null ? `To reach Level ${nextLevel}` : "To finish the road"}</h1>
        <p className="mb-3 text-sm font-semibold text-zinc-700">“{meta.can}”</p>
        <div className="flex flex-col gap-2.5">
          {list.map((s) => {
            const isWeak = s.skill === weakest;
            return (
              <section key={s.skill} className={`rounded-[18px] p-3.5 ${isWeak ? "border-2 border-orange-200 bg-orange-50/40" : "border border-zinc-200"}`}>
                <button type="button" onClick={() => setView({ name: "skill", skill: s.skill })} className="flex w-full items-center gap-3 text-left">
                  <Ring pct={s.pct} skill={s.skill} size={50} tone={s.pct === 100 ? "full" : isWeak ? "weak" : "normal"} />
                  <span className="min-w-0"><span className="flex items-center gap-1.5 text-[17px] font-extrabold text-zinc-900">{s.label}{isWeak ? <span className="rounded-full bg-orange-700 px-2 py-0.5 text-[10px] font-extrabold text-white">Weakest</span> : null}</span><span className="text-[13px] font-semibold text-zinc-600">{s.done} of {s.total} {s.unit}</span></span>
                </button>
                <ul className="mt-2 flex flex-col">
                  {s.rows.map((r) => {
                    const done = r.done >= r.total;
                    const focus = !done && isWeak && r.label === s.focus;
                    return (
                      <li key={r.label} className="flex items-start gap-2.5 py-1.5">
                        <Tick state={done ? "done" : focus ? "focus" : "todo"} />
                        <span className={`min-w-0 flex-1 text-sm leading-snug text-zinc-900 ${focus ? "font-extrabold" : "font-semibold"}`}>{r.label}{r.stars != null ? <Stars n={r.stars} /> : null}</span>
                        {r.stars == null ? <span className="shrink-0 text-xs font-bold text-zinc-500">{r.done}/{r.total}</span> : null}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 border-t border-zinc-100 pt-2 text-xs font-bold text-zinc-600">At the Level Check: {s.passLabel}</p>
              </section>
            );
          })}
        </div>
        {target ? <div className="sticky bottom-20 mt-3"><BigButton title="Play" sub={`${target.label}: ${target.focus}`} disabled={busy} onClick={() => void play(target.skill)} /></div> : null}
        {errorNote}
      </div>
    );
  }

  // Practise home: one level, four rings, one button.
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="relative h-[250px] overflow-hidden tab:rounded-b-3xl">
        <ArenaArt level={meta.level} />
        <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2">
          <button type="button" onClick={() => setView({ name: "road" })} className="flex min-h-10 items-center gap-1.5 rounded-full bg-white/95 px-3 text-[13px] font-extrabold text-zinc-900">Levels</button>
          <Link href="/dashboard/home?view=previous" className="flex min-h-10 items-center rounded-full bg-white/95 px-3 text-[13px] font-extrabold text-zinc-900">Previous practise</Link>
        </div>
      </div>
      <div className="relative -mt-7 rounded-t-[28px] bg-white px-4 pb-5 pt-5">
        <button type="button" onClick={() => setView({ name: "road" })} className="block text-left">
          <span className="flex items-center gap-2"><span className="rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-extrabold tracking-wide text-white">LEVEL {meta.level}</span><span className="text-[13px] font-bold text-zinc-600">{meta.stage}</span></span>
          <span className="mt-2 block text-[32px] font-extrabold leading-tight tracking-tight text-zinc-900">{meta.name} <span lang="pa" className="text-[22px] font-bold text-violet-700">{meta.gurmukhi}</span></span>
          <span className="mt-0.5 block text-[15px] font-semibold leading-snug text-zinc-700">“{meta.can}”</span>
        </button>
        {streak ? <StreakCard home={home} count={streak.count} today={streak.today} /> : null}
        <div className="mt-4 flex justify-center gap-1.5">
          {skills.map((s) => {
            const isWeak = s.skill === weakest;
            return (
              <button key={s.skill} type="button" onClick={() => setView({ name: "skill", skill: s.skill })} aria-label={`${s.label}, ${s.pct} percent`} className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl border-2 pb-2 pt-3 ${isWeak ? "border-orange-200 bg-orange-50" : "border-transparent"}`}>
                {isWeak ? <span className="absolute -top-2 rounded-full bg-orange-700 px-1.5 py-0.5 text-[10px] font-extrabold text-white">Weakest</span> : null}
                <Ring pct={s.pct} skill={s.skill} tone={s.pct === 100 ? "full" : isWeak ? "weak" : "normal"} />
                <span className="text-xs font-extrabold text-zinc-900">{s.label}</span>
                <span className="text-xs font-bold text-zinc-600">{s.pct}%</span>
              </button>
            );
          })}
        </div>
        <button type="button" onClick={() => setView({ name: "checklist" })} className="mt-2 flex min-h-11 w-full items-center justify-center text-sm font-extrabold text-violet-700">
          {nextLevel != null ? `See what you need for Level ${nextLevel}` : "See what you need for the final check"} ›
        </button>
        {home.ready ? (
          <BigButton gold title="Take the Level Check" sub="All your skills are ready" onClick={() => setView({ name: "check" })} />
        ) : weak ? (
          <BigButton title={busy ? "Loading…" : "Play"} sub={`${weak.label}: ${weak.focus}`} disabled={busy} onClick={() => void play(weak.skill)} />
        ) : null}
        {errorNote}
      </div>
    </div>
  );
}

function CheckRunner({ questions, onDone, onLeave }: { questions: CheckQuestion[]; onDone: (picks: string[]) => void; onLeave: () => void }) {
  const sound = usePractiseSound();
  const [picks, setPicks] = useState<string[]>([]);
  const q = questions[picks.length];
  if (!q) return <p className="p-8 text-center font-bold text-zinc-700">Marking…</p>;
  return (
    <div className="mx-auto w-full max-w-md px-4 pb-6 pt-3">
      <div className="flex items-center gap-2">
        <Back onClick={onLeave} label="Leave check" />
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-amber-100"><div className="h-full rounded-full bg-amber-400" style={{ width: `${(picks.length / questions.length) * 100}%` }} /></div>
        <span className="text-[13px] font-extrabold text-zinc-600">{picks.length + 1}/{questions.length}</span>
      </div>
      {q.audioKey ? <div className="mt-6"><AudioButton key={picks.length} audioKey={q.audioKey} large /></div> : null}
      <h1 className="mt-4 text-[27px] font-bold leading-tight tracking-tight text-zinc-900">{q.prompt}</h1>
      <div className="mt-5 flex flex-col gap-2.5">
        {q.options.map((o) => (
          <button key={o.id} type="button" onClick={() => {
            sound("tap");
            const next = [...picks, o.id];
            setPicks(next);
            if (next.length === questions.length) onDone(next);
          }} className="flex min-h-[58px] flex-col justify-center rounded-2xl border-2 border-zinc-200 bg-white px-4 py-2 text-left active:bg-amber-50">
            <span className="text-[17px] font-bold text-zinc-900">{o.label}</span>
            {o.sub ? <span className="text-[13px] font-semibold text-zinc-600">{o.sub}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
