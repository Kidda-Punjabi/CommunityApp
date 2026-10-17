"use client";

import { startLevelTest, submitLevelAnswer } from "@/app/dashboard/community/placement/actions";
import { gapMessage, LEVEL_COPY } from "@/lib/community/placement-copy";
import { bandFillVar, bandForLevel, bandInkVar, levelFillVar, levelInkVar, levelLabel } from "@/lib/community/levels";
import type { PublicItem } from "@/lib/community/placement-public";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Scores = { understanding: number; speaking: number; kiddaLevel: number; soundIssue: boolean };

const PROFILE = [
  {
    prompt: "When your family speaks Punjabi, how much do you understand?",
    options: ["Hardly anything", "Some words", "Most of it", "Everything"],
  },
  {
    prompt: "How do you reply when someone speaks Punjabi to you?",
    options: ["In English", "A few Punjabi words", "Short Punjabi sentences", "Comfortably in Punjabi"],
  },
] as const;

function speak(text: string | null) {
  if (!text || typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "pa-IN";
  window.speechSynthesis.speak(utterance);
}

export function PlacementTest() {
  const [stage, setStage] = useState<"intro" | "profile" | "question" | "result">("intro");
  const [profileStep, setProfileStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(120);
  const [item, setItem] = useState<PublicItem | null>(null);
  const [showWords, setShowWords] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [correctId, setCorrectId] = useState<string | null>(null);
  const [scores, setScores] = useState<Scores | null>(null);
  const [podName, setPodName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const starting = useRef(false);

  useEffect(() => {
    if (!deadline || stage === "result") return;
    const timer = window.setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    }, 250);
    return () => window.clearInterval(timer);
  }, [deadline, stage]);

  async function chooseProfile(value: number) {
    const next = [...answers, value];
    setAnswers(next);
    if (profileStep === 0) {
      setProfileStep(1);
      return;
    }
    if (starting.current) return;
    starting.current = true;
    try {
      const started = await startLevelTest(next[0], next[1]);
      if ("error" in started && started.error) {
        setError(started.error);
        return;
      }
      if (!("attemptId" in started)) return;
      setAttemptId(started.attemptId);
      setDeadline(Date.parse(started.deadline));
      setItem(started.item);
      setStage(started.item ? "question" : "result");
    } finally {
      starting.current = false;
    }
  }

  async function chooseOption(optionId: string) {
    if (!attemptId || !item || picked) return;
    setPicked(optionId);
    const result = await submitLevelAnswer(attemptId, item.id, optionId);
    if ("error" in result && result.error) {
      setError(result.error);
      setPicked(null);
      return;
    }
    if ("correctOptionId" in result && result.correctOptionId) setCorrectId(result.correctOptionId);
    window.setTimeout(() => {
      if ("scores" in result && result.scores) {
        setScores(result.scores);
        setPodName(result.podName);
        setStage("result");
        return;
      }
      if ("item" in result) setItem(result.item);
      setPicked(null);
      setCorrectId(null);
      setShowWords(false);
    }, 700);
  }

  return (
    <div className="pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {stage === "intro" ? (
        <section>
          <h1 className="font-heading text-2xl font-bold text-zinc-900">Find your Punjabi level in 2 minutes</h1>
          <div className="mt-4 grid grid-cols-5 gap-1">
            {Array.from({ length: 10 }, (_, level) => (
              <span key={level} className="flex h-8 items-center justify-center rounded-full text-xs font-semibold" style={{ background: levelFillVar(level), color: levelInkVar(level) }}>
                {level}
              </span>
            ))}
          </div>
          <button type="button" className="mt-6 min-h-11 w-full rounded-full bg-violet-600 text-sm font-semibold text-white" onClick={() => setStage("profile")}>
            Start
          </button>
        </section>
      ) : null}

      {stage === "profile" ? (
        <section>
          <h1 className="font-heading text-xl font-semibold text-zinc-900">{PROFILE[profileStep].prompt}</h1>
          <div className="mt-4 space-y-2">
            {PROFILE[profileStep].options.map((option, index) => (
              <button key={option} type="button" className="min-h-11 w-full rounded-2xl bg-white px-4 text-left text-[16px] font-medium text-zinc-800 shadow-sm" onClick={() => void chooseProfile(index)}>
                {option}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {stage === "question" && item ? (
        <section>
          <div className="mb-3 flex items-center justify-between text-sm">
            <span>Level {item.kind === "sound" ? 0 : ""}</span>
            <span className={remaining <= 20 ? "font-semibold text-red-600" : "text-zinc-500"}>{remaining}s</span>
          </div>
          <div className="mb-4 h-1.5 rounded-full bg-zinc-200">
            <div className="h-1.5 rounded-full bg-violet-600" style={{ width: `${((120 - remaining) / 120) * 100}%` }} />
          </div>
          <h1 className="font-heading text-xl font-semibold text-zinc-900">{item.prompt}</h1>
          <button type="button" className="mt-4 min-h-11 rounded-full bg-violet-600 px-5 text-sm font-semibold text-white" onClick={() => speak(item.speak)}>
            Play
          </button>
          {item.roman ? (
            <button type="button" className="ml-2 min-h-11 text-sm font-semibold text-violet-700" onClick={() => setShowWords((value) => !value)}>
              {showWords ? "Hide words" : "Show words"}
            </button>
          ) : null}
          {showWords && item.roman ? <p className="mt-2 text-sm text-zinc-600">{item.roman}</p> : null}
          <div className="mt-4 space-y-2">
            {item.options.map((option) => {
              const tone = correctId == null ? "bg-white" : option.id === correctId ? "bg-emerald-100" : option.id === picked ? "bg-red-100" : "bg-white";
              return (
                <div key={option.id} className={`flex min-h-11 items-center gap-2 rounded-2xl px-3 ${tone}`}>
                  <button type="button" className="min-h-11 flex-1 text-left text-[16px]" disabled={picked != null} onClick={() => void chooseOption(option.id)}>
                    {option.label}
                  </button>
                  {option.speak ? (
                    <button type="button" className="min-h-11 px-2 text-sm font-semibold text-violet-700" onClick={() => speak(option.speak)}>
                      Play
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {stage === "result" && scores ? (
        <section>
          <p className="inline-flex rounded-full px-3 py-1 text-sm font-semibold" style={{ background: levelFillVar(scores.kiddaLevel), color: levelInkVar(scores.kiddaLevel) }}>
            {levelLabel(scores.kiddaLevel)}
          </p>
          <p className="mt-4 text-sm text-zinc-700">{gapMessage(scores.understanding, scores.speaking)}</p>
          <p className="mt-3 text-sm text-zinc-700">Understanding {scores.understanding} · Speaking {scores.speaking}</p>
          <div className="mt-4 space-y-2 text-sm text-zinc-700">
            <p>What you can do now: {LEVEL_COPY[scores.kiddaLevel].now}</p>
            <p>What the next level unlocks: {LEVEL_COPY[scores.kiddaLevel].next}</p>
            <p>Recommended for you: {LEVEL_COPY[scores.kiddaLevel].recommended}, plus the Kidda Community to practise every week.</p>
          </div>
          {scores.soundIssue ? (
            <p className="mt-3 text-sm text-zinc-700">Some Punjabi sounds don't exist in English. Our Foundational course fixes this fast.</p>
          ) : null}
          {podName ? (
            <p className="mt-4 rounded-2xl px-3 py-2 text-sm font-semibold" style={{ background: bandFillVar(bandForLevel(scores.kiddaLevel)), color: bandInkVar(bandForLevel(scores.kiddaLevel)) }}>
              You're in {podName}
            </p>
          ) : null}
          <Link href="/dashboard/community" className="mt-6 inline-flex min-h-11 items-center rounded-full bg-violet-600 px-5 text-sm font-semibold text-white">
            Continue
          </Link>
        </section>
      ) : null}
      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
