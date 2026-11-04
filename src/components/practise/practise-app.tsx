"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { getStreakPresentation } from "@/app/dashboard/home/streak-actions";
import { getLevelPreview, startLevelCheck, startRound, submitLevelCheck, submitRound } from "@/app/dashboard/home/practise-actions";
import { getLocalActivityDate } from "@/lib/progress/activity-date";
import { LEVELS } from "@/lib/practise/levels";
import { usePractiseSound } from "@/lib/practise/sounds";
import type { CheckQuestion, CheckResult, LevelPreview, PractiseHome, PractiseSkill, RoundAnswer, RoundQuestion, RoundResult, SkillRoundScore, SkillSummary } from "@/lib/practise/types";
import { ArenaArt } from "./arena-art";
import { LevelRoad } from "./level-road";
import { Flame, StreakCelebration, StreakDays, StreakStyles, XpProgress } from "./streak-screens";
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
  const col = { weak: "#6D28D9", full: "#15803D", normal: "#7C3AED" }[tone];
  const bg = { weak: "#DDD0FB", full: "#DCF3E3", normal: "#EDE5FF" }[tone];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size, color: col }}>
      <svg aria-hidden="true" width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={bg} strokeWidth="7" />
        {pct > 0 ? <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(c * Math.min(pct, 100)) / 100} ${c}`} className="transition-[stroke,stroke-dasharray] duration-700" /> : null}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center"><Icon skill={skill} size={Math.round(size * 0.36)} /></div>
    </div>
  );
}

function SkillRise({ score }: { score: SkillRoundScore }) {
  const gain = score.creditAfter - score.creditBefore;
  const [phase, setPhase] = useState<"before" | "plus" | "merged">(gain > 0 ? "before" : "merged");
  useEffect(() => {
    if (gain <= 0) return;
    const plus = window.setTimeout(() => setPhase("plus"), 700);
    const merged = window.setTimeout(() => setPhase("merged"), 1900);
    return () => {
      window.clearTimeout(plus);
      window.clearTimeout(merged);
    };
  }, [gain]);
  const rising = gain > 0 && phase !== "before";
  const ringPct = phase === "before" ? score.creditBefore : score.creditAfter;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 rounded-2xl bg-violet-50 px-2 py-3 text-center">
      <Ring pct={ringPct} skill={score.skill} size={52} tone={rising ? "full" : "normal"} />
      <div>
        <p className="text-sm font-extrabold leading-tight text-zinc-900">{score.label}</p>
        <p className="mt-1 text-[22px] font-extrabold leading-none tabular-nums" aria-label={phase === "plus" ? `${score.creditBefore}% plus ${gain}%` : `${phase === "merged" ? score.creditAfter : score.creditBefore}%`}>
          {phase === "plus" ? (
            <span className="flex flex-col gap-1">
              <span className="text-zinc-700">{score.creditBefore}%</span>
              <span className="text-lg text-green-700">+{gain}%</span>
            </span>
          ) : (
            <span className={rising ? "text-green-700" : "text-zinc-700"}>{phase === "merged" ? score.creditAfter : score.creditBefore}%</span>
          )}
        </p>
      </div>
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
  if (state === "focus") return <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-700 text-white"><svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z" /></svg></span>;
  return <span className="mx-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-zinc-300" />;
}

function Stars({ n }: { n: number }) {
  return <span className="mt-0.5 flex gap-px" role="img" aria-label={`${n} of 3 stars`}>{[0, 1, 2].map((i) => <svg key={i} aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill={i < n ? "#F59E0B" : "#E5E7EB"}><path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5-5.9-3.1-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" /></svg>)}</span>;
}

function useStreak() {
  const [streak, setStreak] = useState<{ count: number; today: string; lit: boolean } | null>(null);
  useEffect(() => {
    const today = getLocalActivityDate();
    void getStreakPresentation(today).then((s) => { if (s && !("error" in s)) setStreak({ count: s.streak, today, lit: s.streak > 0 && s.dayGap === 0 }); }).catch(() => undefined);
  }, []);
  return { streak, setStreak };
}

/** The dashboard is a phone-width column on a laptop. These break out of it from the centre. */
const WIDE = "lg:relative lg:left-1/2 lg:max-w-none lg:-translate-x-1/2";

type View =
  | { name: "home" } | { name: "checklist" } | { name: "skill"; skill: PractiseSkill } | { name: "road" }
  | { name: "preview"; data: LevelPreview } | { name: "round"; questions: RoundQuestion[] }
  | { name: "result"; result: RoundResult; streakFrom: number }
  | { name: "streak"; from: number; to: number; result: RoundResult } | { name: "check" }
  | { name: "checkRun"; checkId: string; questions: CheckQuestion[] } | { name: "checkResult"; result: CheckResult } | { name: "levelUp" };

export function PractiseApp({ home }: { home: PractiseHome }) {
  const router = useRouter();
  const sound = usePractiseSound();
  const { streak, setStreak } = useStreak();
  const [streakOpen, setStreakOpen] = useState(false);
  const [view, setView] = useState<View>(home.levelUpFrom != null ? { name: "levelUp" } : { name: "home" });
  const practiseFocus = view.name === "round" || view.name === "result" || view.name === "streak";
  if (typeof document !== "undefined") document.documentElement.toggleAttribute("data-practise-focus", practiseFocus);
  useEffect(() => {
    document.documentElement.toggleAttribute("data-practise-focus", practiseFocus);
    return () => document.documentElement.removeAttribute("data-practise-focus");
  }, [practiseFocus]);
  const [off, setOff] = useState({ speaking: false, listening: false });
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("kidda:practise-off");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setOff(JSON.parse(saved));
    } catch { /* storage can be blocked */ }
  }, []);
  const saveOff = (next: typeof off) => {
    setOff(next);
    try { sessionStorage.setItem("kidda:practise-off", JSON.stringify(next)); } catch { /* storage can be blocked */ }
  };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { meta, skills, weakest } = home;
  const weak = skills.find((s) => s.skill === weakest) ?? null;
  const nextLevel = meta.level < 9 ? meta.level + 1 : null;

  useEffect(() => { if (view.name === "levelUp") sound("levelUp"); /* once on arrival */ }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (view.name !== "road") window.scrollTo({ top: 0 }); }, [view.name]);

  const go = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await fn(); } catch { setError("That didn't work. Please try again."); } finally { setBusy(false); }
  };
  const mixLabel = skills.map((s) => s.label).join(", ");
  const offNote = off.speaking || off.listening ? (
    <button type="button" onClick={() => saveOff({ speaking: false, listening: false })} className="mb-3 w-full rounded-2xl bg-violet-50 px-3 py-3 text-left text-sm font-semibold leading-snug text-zinc-800">
      {off.speaking && off.listening ? "Speaking and listening are off" : off.speaking ? "Speaking is off" : "Listening is off"} for this visit. Every Play skips {off.speaking && off.listening ? "them" : "it"} until you turn {off.speaking && off.listening ? "them" : "it"} back on, or close the app. <span className="font-extrabold text-violet-700">Turn back on</span>
    </button>
  ) : null;
  const play = () => go(async () => {
    sound("tap");
    const questions = await startRound();
    setView({ name: "round", questions });
  });
  const finishRound = (answers: RoundAnswer[]) => go(async () => {
    const result = await submitRound(answers, getLocalActivityDate());
    const today = getLocalActivityDate();
    const from = streak?.lit ? streak.count : (streak?.count ?? 0);
    if (result.streakExtended && result.streak != null) setView({ name: "streak", from, to: result.streak, result });
    else setView({ name: "result", result, streakFrom: from });
    if (result.streak != null) setStreak({ count: result.streak, today, lit: true });
    sound("finish");
    router.refresh();
  });

  const shell = `mx-auto w-full max-w-md px-4 pb-6 pt-3 ${WIDE} lg:w-[720px] lg:pt-8`;
  const errorNote = error ? <p role="alert" className="mt-2 text-center text-sm font-semibold text-orange-800">{error}</p> : null;

  if (view.name === "round") return <RoundPlayer questions={view.questions} onLeave={() => setView({ name: "home" })} onFinish={(a) => void finishRound(a)} off={off} onTurnOff={(k) => saveOff({ ...off, [k]: true })} />;

  if (view.name === "streak") {
    return (
      <div className="fixed inset-0 z-40 overflow-hidden bg-white">
        <StreakCelebration from={view.from} to={view.to} today={getLocalActivityDate()} playedDates={[...home.playedDates, getLocalActivityDate()]} playSound={() => sound("streak")} onContinue={() => setView({ name: "result", result: view.result, streakFrom: view.from })} />
      </div>
    );
  }

  if (view.name === "result") {
    const r = view.result;
    return (
      <div className="fixed inset-0 z-40 overflow-hidden bg-zinc-50">
      <div className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] lg:max-w-[640px]">
        <h1 className="text-center text-[28px] font-extrabold tracking-tight text-zinc-900">Round complete!</h1>
        {r.xpEarned > 0 || r.xpToday > 0 ? <div className="mt-4"><XpProgress earned={r.xpEarned} today={r.xpToday} goal={r.xpGoal} /></div> : null}
        <div className="mt-4 grid min-h-0 flex-1 grid-cols-2 grid-rows-2 content-stretch gap-3">
          {r.skills.map((s) => <SkillRise key={s.skill} score={s} />)}
        </div>
        {r.saved.length ? (
          <div className="mt-3 rounded-2xl bg-zinc-50 p-3">
            <p className="text-xs font-extrabold tracking-wide text-zinc-600">YOU GOT THESE RIGHT</p>
            <p className="mt-1 line-clamp-3 text-sm font-bold text-zinc-900">{r.saved.slice(0, 6).join(", ")}{r.saved.length > 6 ? ` and ${r.saved.length - 6} more` : ""}</p>
          </div>
        ) : null}
        <div className="mt-4"><BigButton title={busy ? "Loading…" : "Play"} disabled={busy} onClick={() => void play()} /></div>
        <button type="button" onClick={() => setView({ name: "home" })} className="mt-2 min-h-11 w-full text-sm font-bold text-zinc-500">Done</button>
        {errorNote}
      </div>
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
    return (
      <div className="mx-auto w-full max-w-md px-4 pb-10 pt-3">
        <div className="mb-2 flex items-center gap-1"><Back onClick={() => setView({ name: "home" })} /><h1 className="text-xl font-extrabold text-zinc-900">Your road</h1></div>
        <LevelRoad current={meta.level} disabled={busy} onPick={(n) => n === meta.level ? setView({ name: "checklist" }) : void go(async () => setView({ name: "preview", data: await getLevelPreview(n) }))} />
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
      <div className={`mx-auto w-full max-w-md px-4 pb-2 pt-3 ${WIDE} lg:w-[1040px] lg:pt-8`}>
        <div className="relative h-24 overflow-hidden rounded-3xl lg:h-44"><ArenaArt level={meta.level} /><div className="absolute left-2 top-2"><Back onClick={() => setView({ name: "home" })} /></div></div>
        <p className="mt-3 text-[13px] font-bold text-zinc-600">Level {meta.level} · {meta.name}</p>
        <h1 className="text-[26px] font-extrabold tracking-tight text-zinc-900">{view.name === "skill" ? list[0].label : nextLevel != null ? `To reach Level ${nextLevel}` : "To finish the road"}</h1>
        <p className="mb-3 text-sm font-semibold text-zinc-700">“{meta.can}”</p>
        <div className={`flex flex-col gap-2.5 ${list.length > 1 ? "lg:grid lg:grid-cols-2 lg:items-start lg:gap-4" : ""}`}>
          {list.map((s) => {
            const isWeak = s.skill === weakest;
            return (
              <section key={s.skill} className={`rounded-[18px] p-3.5 ${isWeak ? "border-2 border-violet-300 bg-violet-50/50" : "border border-zinc-200"}`}>
                <button type="button" onClick={() => setView({ name: "skill", skill: s.skill })} className="flex w-full items-center gap-3 text-left">
                  <Ring pct={s.creditPct} skill={s.skill} size={50} tone={s.pct === 100 ? "full" : isWeak ? "weak" : "normal"} />
                  <span className="min-w-0"><span className="flex items-center gap-1.5 text-[17px] font-extrabold text-zinc-900">{s.label}{isWeak ? <span className="rounded-full bg-violet-700 px-2 py-0.5 text-[10px] font-extrabold text-white">Focus</span> : null}</span><span className="text-[13px] font-semibold text-zinc-600">{s.practised} of {s.total} {s.unit} saved</span></span>
                </button>
                <p className="mt-2 text-[13px] font-semibold leading-snug text-zinc-600">{s.howItWorks}</p>
                <ul className="mt-2 flex flex-col">
                  {s.rows.map((r) => {
                    const done = r.done >= r.total;
                    const focus = !done && isWeak && r.label === s.focus;
                    return (
                      <li key={r.label} className="flex items-start gap-2.5 py-1.5">
                        <Tick state={done ? "done" : focus ? "focus" : "todo"} />
                        <span className={`min-w-0 flex-1 text-sm leading-snug text-zinc-900 ${focus ? "font-extrabold" : "font-semibold"}`}>{r.label}{r.stars != null ? <Stars n={r.stars} /> : null}</span>
                        {r.stars == null ? <span className="shrink-0 text-xs font-bold text-zinc-500">{r.practised}/{r.total}</span> : r.practised > 0 && r.done < r.total ? <span className="shrink-0 text-xs font-bold text-zinc-500">{r.practised} correct</span> : null}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 border-t border-zinc-100 pt-2 text-xs font-bold text-zinc-600">At the Level Check: {s.passLabel}</p>
              </section>
            );
          })}
        </div>
        {target ? <div className="sticky bottom-28 mx-auto mt-3 lg:static lg:mt-5 lg:max-w-md">{offNote}<BigButton title="Play" sub={mixLabel} disabled={busy} onClick={() => void play()} /></div> : null}
        {errorNote}
      </div>
    );
  }

  // Practise home: one level, four rings, one button.
  return (
    <div className={`mx-auto w-full max-w-md relative ${WIDE} lg:grid lg:w-[1040px] lg:grid-cols-[1.1fr_1fr] lg:gap-6 lg:pt-8`}>
      <StreakStyles />
      {streakOpen && streak ? (
        <div className="absolute inset-x-3 top-16 z-20 rounded-3xl border border-zinc-200 bg-white p-4 shadow-xl lg:left-6 lg:right-auto lg:top-24 lg:w-96">
          <div className="flex items-center gap-3">
            <span className="relative shrink-0"><Flame lit={streak.lit} size={68} /><span className={`absolute inset-x-0 bottom-1 text-center text-2xl font-extrabold ${streak.lit ? "text-zinc-900" : "text-zinc-500"}`}>{streak.count}</span></span>
            <div className="min-w-0 flex-1">
              <p className="text-xl font-extrabold text-zinc-900">Streak</p>
              <p className="text-sm font-semibold leading-snug text-zinc-600">{streak.lit ? "Done for today. See you tomorrow." : "Finish one round today to light your flame."}</p>
            </div>
            <button type="button" onClick={() => setStreakOpen(false)} aria-label="Close" className="flex h-11 w-11 shrink-0 items-center justify-center text-zinc-500"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
          </div>
          <div className="mt-3"><StreakDays today={streak.today} streak={streak.count} lit={streak.lit} playedDates={home.playedDates} /></div>
        </div>
      ) : null}
      <div className="relative h-[250px] overflow-hidden tab:rounded-b-3xl lg:h-[600px] lg:rounded-3xl">
        <button type="button" onClick={() => setView({ name: "road" })} aria-label={`Level ${meta.level}, ${meta.name}. See all levels`} className="block h-full w-full">
          <ArenaArt level={meta.level} />
        </button>
        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-center justify-between gap-2">
          <button type="button" onClick={() => setView({ name: "road" })} aria-label="See your road" className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-zinc-900"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4v-5h4v-5h4V5h4" /></svg></button>
          {streak ? (
            <button type="button" onClick={() => setStreakOpen(!streakOpen)} aria-expanded={streakOpen} aria-label={`${streak.count} day streak. ${streak.lit ? "Done for today" : "Not done yet today"}`} className="pointer-events-auto flex min-h-11 items-center gap-1 rounded-full bg-white/95 px-3">
              <Flame lit={streak.lit} size={20} />
              <span className={`text-[15px] font-extrabold ${streak.lit ? "text-amber-600" : "text-zinc-500"}`}>{streak.count}</span>
            </button>
          ) : null}
          <Link href="/dashboard/home?view=previous" className="pointer-events-auto flex min-h-10 items-center rounded-full bg-white/95 px-3 text-[13px] font-extrabold text-zinc-900">Previous practise</Link>
        </div>
      </div>
      <div className="relative -mt-7 rounded-t-[28px] bg-white px-4 pb-12 pt-5 lg:mt-0 lg:flex lg:flex-col lg:justify-center lg:rounded-3xl lg:border lg:border-zinc-200 lg:px-8">
        <div className="block text-left">
          <span className="flex items-center gap-2"><span className="rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-extrabold tracking-wide text-white">LEVEL {meta.level}</span><span className="text-[13px] font-bold text-zinc-600">{meta.stage}</span></span>
          <span className="mt-2 block text-[32px] font-extrabold leading-tight tracking-tight text-zinc-900">{meta.name} <span lang="pa" className="text-[22px] font-bold text-violet-700">{meta.gurmukhi}</span></span>
          <span className="mt-0.5 block text-[15px] font-semibold leading-snug text-zinc-700">“{meta.can}”</span>
        </div>
        <div className="mt-4 flex justify-center gap-1.5">
          {skills.map((s) => {
            const isWeak = s.skill === weakest;
            return (
              <button key={s.skill} type="button" onClick={() => setView({ name: "skill", skill: s.skill })} aria-label={`${s.label}, ${s.practised} of ${s.total} saved`} className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl border-2 pb-2 pt-3 ${isWeak ? "border-violet-300 bg-violet-50" : "border-transparent"}`}>
                {isWeak ? <span className="absolute -top-2 rounded-full bg-violet-700 px-1.5 py-0.5 text-[10px] font-extrabold text-white">Focus</span> : null}
                <Ring pct={s.creditPct} skill={s.skill} tone={s.pct === 100 ? "full" : isWeak ? "weak" : "normal"} />
                <span className="text-xs font-extrabold text-zinc-900">{s.label}</span>
                <span className="text-xs font-bold text-zinc-600">{s.creditPct}%</span>
              </button>
            );
          })}
        </div>
        <button type="button" onClick={() => setView({ name: "checklist" })} className="mt-2 flex min-h-11 w-full items-center justify-center text-sm font-extrabold text-violet-700">
          {nextLevel != null ? `See what you need for Level ${nextLevel}` : "See what you need for the final check"} ›
        </button>
        {streak && !streak.lit && streak.count > 0 ? <p className="mb-2 text-center text-sm font-bold text-amber-700">Play today to keep your {streak.count} day streak</p> : null}
        {offNote}
        {home.ready ? (
          <BigButton gold title="Take the Level Check" sub="All your skills are ready" onClick={() => setView({ name: "check" })} />
        ) : weak ? (
          <BigButton title={busy ? "Loading…" : "Play"} sub={mixLabel} disabled={busy} onClick={() => void play()} />
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
      {q.audioKey ? <div className="mt-6"><AudioButton key={picks.length} audioKey={q.audioKey} large noSlow /></div> : null}
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
