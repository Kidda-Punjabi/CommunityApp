"use client";

import { BookOpen, ChevronLeft, ChevronRight, Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { startWeekRound, submitWeekRound, type WeekRoundResult } from "@/app/dashboard/learn/beginners/week/week-practice-actions";
import { deckPracticeHref } from "@/lib/flashcards/utils";
import { getLocalActivityDate } from "@/lib/progress/activity-date";
import { usePractiseSound } from "@/lib/practise/sounds";
import type { PractiseSkill, RoundAnswer, RoundQuestion } from "@/lib/practise/types";
import type { WeekDeck, WeekSkillSummary } from "@/lib/practise/week-content";
import { RoundPlayer } from "./round-player";
import { StreakStyles } from "./streak-screens";

const ICONS: Record<PractiseSkill, ReactNode> = {
  words: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5M9 8h6M9 12h6" /></>,
  grammar: <><rect x="3" y="14" width="8" height="7" rx="1" /><rect x="13" y="14" width="8" height="7" rx="1" /><rect x="8" y="4" width="8" height="7" rx="1" /></>,
  listening: <><path d="M4 15v-3a8 8 0 0 1 16 0v3" /><rect x="2.5" y="14" width="5" height="7" rx="1.5" /><rect x="16.5" y="14" width="5" height="7" rx="1.5" /></>,
  speaking: <><rect x="9" y="2.5" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5" /></>,
};

function SkillIcon({ skill, size }: { skill: PractiseSkill; size: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{ICONS[skill]}</svg>;
}

/** A filled skill turns solid purple and shines, like a mastered topic on the old Practice page. */
function SkillBadge({ skill, pct }: { skill: PractiseSkill; pct: number }) {
  const size = 60;
  if (pct >= 100) {
    return (
      <span className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-violet-600 text-white shadow-[0_6px_20px_-4px_rgba(124,58,237,0.6)]" style={{ width: size, height: size }}>
        <span className="topic-mastery-icon-shine"><SkillIcon skill={skill} size={26} /></span>
        <span aria-hidden="true" className="topic-mastery-shine pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/50 to-transparent" />
      </span>
    );
  }
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative shrink-0 text-violet-600" style={{ width: size, height: size }}>
      <svg aria-hidden="true" width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EDE5FF" strokeWidth="7" />
        {pct > 0 ? <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(c * pct) / 100} ${c}`} className="transition-[stroke-dasharray] duration-700" /> : null}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center"><SkillIcon skill={skill} size={22} /></span>
    </span>
  );
}

function SkillGrid({ skills, focus }: { skills: WeekSkillSummary[]; focus: PractiseSkill | null }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      {skills.map((s) => {
        const done = s.creditPct >= 100;
        const isFocus = s.skill === focus;
        return (
          <div key={s.skill} className={`relative flex min-w-0 items-center gap-2.5 rounded-[18px] px-3 py-3.5 ${done || isFocus ? "bg-violet-100" : "bg-violet-50/60"}`}>
            {isFocus ? <span className="absolute -top-2 right-2.5 rounded-full bg-violet-700 px-2 py-0.5 text-[11px] font-extrabold text-white">Focus</span> : null}
            <SkillBadge skill={s.skill} pct={s.creditPct} />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-sm font-extrabold text-zinc-900">{s.label}</span>
              <span className={`text-[13px] font-bold ${done ? "text-violet-800" : "text-zinc-600"}`}>{done ? "Mastered" : `${s.creditPct}%`}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function WeekPractice({
  week,
  lessonId,
  title,
  skills: initialSkills,
  decks,
  isRecap,
}: {
  week: number;
  lessonId: string;
  title: string;
  skills: WeekSkillSummary[];
  decks: WeekDeck[];
  isRecap: boolean;
}) {
  const sound = usePractiseSound();
  const [skills, setSkills] = useState(initialSkills);
  const [questions, setQuestions] = useState<RoundQuestion[] | null>(null);
  const [result, setResult] = useState<WeekRoundResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const hideChrome = questions != null;
  useEffect(() => {
    document.documentElement.toggleAttribute("data-practise-focus", hideChrome);
    return () => document.documentElement.removeAttribute("data-practise-focus");
  }, [hideChrome]);

  const go = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await fn(); } catch { setError("That didn't work. Please try again."); } finally { setBusy(false); }
  };
  const play = () => go(async () => {
    sound("tap");
    setResult(null);
    setQuestions(await startWeekRound(week));
  });
  const finish = (answers: RoundAnswer[]) => go(async () => {
    const r = await submitWeekRound(week, answers, getLocalActivityDate());
    setQuestions(null);
    setResult(r);
    setSkills(r.skills);
    sound("finish");
  });

  if (questions) {
    return <RoundPlayer questions={questions} onLeave={() => setQuestions(null)} onFinish={(a) => void finish(a)} off={off} onTurnOff={(k) => saveOff({ ...off, [k]: true })} />;
  }

  const mastered = skills.length > 0 && skills.every((s) => s.creditPct >= 100);
  const open = skills.filter((s) => s.creditPct < 100);
  const focus = open.length ? [...open].sort((a, b) => a.creditPct - b.creditPct)[0].skill : null;
  const offLabel = off.speaking && off.listening ? "Speaking and listening off" : off.speaking ? "Speaking off" : off.listening ? "Listening off" : null;
  const backHref = `/dashboard/learn/beginners#lesson-${lessonId}`;

  return (
    <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col lg:max-w-3xl">
      <StreakStyles />
      <div className={`relative flex shrink-0 items-center justify-between overflow-hidden px-4 pb-11 pt-3 ${mastered ? "bg-violet-600 text-white" : "bg-[#C9C1EF]"}`}>
        {mastered ? <span aria-hidden="true" className="topic-mastery-shine pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent" /> : null}
        <Link href={backHref} aria-label="Back" className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white text-zinc-900">
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Link>
        {mastered ? (
          <span className="relative flex items-center gap-1.5 text-[15px] font-extrabold"><Star className="h-5 w-5 fill-white" aria-hidden />Mastered</span>
        ) : null}
      </div>
      <section className="relative -mt-6 flex flex-1 flex-col gap-3.5 rounded-t-[26px] bg-white px-5 pb-4 pt-5">
        <div>
          <span className="flex items-center gap-2"><span className="rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-extrabold tracking-wide text-white">WEEK {week}</span><span className="text-sm font-semibold text-zinc-600">Beginners</span></span>
          <h1 className="mt-2 font-heading text-[30px] font-extrabold leading-tight tracking-tight text-zinc-900">{title}</h1>
          <p className="mt-0.5 text-sm font-medium text-zinc-700">
            {mastered
              ? "You've mastered everything from this week."
              : isRecap
                ? "Play until all four are full. A mix from across the course."
                : "Play until all four are full. This week's words and grammar only."}
          </p>
        </div>
        {result ? (
          <p role="status" className="rounded-2xl bg-violet-50 px-4 py-3 text-sm font-bold text-zinc-900">
            Round complete: {result.correct} of {result.total}{result.xpEarned > 0 ? ` · +${result.xpEarned} XP` : ""}{result.streak != null ? ` · ${result.streak} day streak` : ""}
          </p>
        ) : null}
        <SkillGrid skills={skills} focus={focus} />
        {decks.length ? (
          <details className="group rounded-[18px] border border-[#ECE9F5] bg-white">
            <summary className="flex min-h-[58px] cursor-pointer list-none items-center gap-3 p-2.5 pr-3.5 [&::-webkit-details-marker]:hidden">
              <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-[#F1EBFF] text-violet-700"><BookOpen className="h-5 w-5" aria-hidden /></span>
              <span className="flex-1 text-[15px] font-extrabold text-zinc-900">Flashcards</span>
              <ChevronRight className="h-5 w-5 text-zinc-500 transition-transform group-open:rotate-90" aria-hidden />
            </summary>
            <ul className="border-t border-[#F1EFF7] px-3.5 py-1">
              {decks.map((deck) => (
                <li key={deck.deckId}><Link href={deckPracticeHref(lessonId, deck.deckId)} className="flex min-h-11 items-center text-sm font-semibold text-violet-800">{deck.name}</Link></li>
              ))}
            </ul>
          </details>
        ) : null}
        <div className="mt-auto pt-2">
          <button type="button" disabled={busy || skills.length === 0} onClick={() => void play()} className="flex h-[76px] w-full items-center justify-center rounded-[20px] bg-violet-600 text-[27px] font-extrabold text-white shadow-[0_5px_0_#5B21B6] transition active:scale-[0.98] disabled:opacity-60">
            {busy ? "Loading…" : mastered ? "Play again" : "Play"}
          </button>
          {offLabel ? (
            <p className="mt-3 text-center text-[13px] font-semibold text-zinc-700">
              {offLabel} this visit ·{" "}
              <button type="button" onClick={() => saveOff({ speaking: false, listening: false })} className="min-h-6 font-extrabold text-violet-700">Turn on</button>
            </p>
          ) : null}
          {skills.length === 0 ? <p className="mt-2 text-center text-sm font-semibold text-zinc-700">Practice for this week is coming soon.</p> : null}
          {error ? <p role="alert" className="mt-2 text-center text-sm font-semibold text-orange-800">{error}</p> : null}
        </div>
      </section>
    </div>
  );
}
