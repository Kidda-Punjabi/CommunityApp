"use client";

import { startLevelTest, submitLevelAnswer } from "@/app/dashboard/community/placement/actions";
import { OnboardingButton, OnboardingFrame } from "@/components/community/onboarding-shell";
import type { PublicItem } from "@/lib/community/placement-public";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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

function playClip(url: string | null) {
  if (!url) return;
  const audio = new Audio(url);
  void audio.play();
}

export function PlacementTest() {
  const router = useRouter();
  const [profileStep, setProfileStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(120);
  const [item, setItem] = useState<PublicItem | null>(null);
  const [showWords, setShowWords] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [correctId, setCorrectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const starting = useRef(false);

  useEffect(() => {
    if (!deadline || !item) return;
    const timer = window.setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    }, 250);
    return () => window.clearInterval(timer);
  }, [deadline, item]);

  useEffect(() => {
    if (item?.audioUrl) {
      const audio = new Audio(item.audioUrl);
      audio.preload = "auto";
    }
  }, [item]);

  async function chooseProfile(value: number) {
    const next = [...answers, value];
    setAnswers(next);
    if (profileStep === 0) {
      setProfileStep(1);
      return;
    }
    if (starting.current) return;
    starting.current = true;
    setPending(true);
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
      if (!started.item) router.push("/dashboard/community/welcome/done");
    } finally {
      starting.current = false;
      setPending(false);
    }
  }

  async function chooseOption(optionId: string) {
    if (!attemptId || !item || picked || pending) return;
    setPending(true);
    setPicked(optionId);
    const result = await submitLevelAnswer(attemptId, item.id, optionId);
    if ("error" in result && result.error) {
      setError(result.error);
      setPicked(null);
      setPending(false);
      return;
    }
    if ("correctOptionId" in result && result.correctOptionId) setCorrectId(result.correctOptionId);
    window.setTimeout(() => {
      if ("scores" in result && result.scores) {
        router.push("/dashboard/community/welcome/done");
        return;
      }
      if ("item" in result) setItem(result.item);
      setPicked(null);
      setCorrectId(null);
      setShowWords(false);
      setPending(false);
    }, 700);
  }

  if (!item) {
    const question = PROFILE[profileStep];
    return (
      <OnboardingFrame
        step="3 of 3"
        backHref="/dashboard/community/welcome/levels"
        action={<span className="block h-14" />}
      >
        <div>
          <h1 className="font-heading text-2xl font-extrabold">{question.prompt}</h1>
          <div className="mt-4 space-y-2">
            {question.options.map((option, index) => (
              <button key={option} type="button" disabled={pending} onClick={() => void chooseProfile(index)} className="flex h-14 w-full items-center rounded-[18px] bg-white px-4 text-left text-[16px] font-semibold active:scale-[0.99] disabled:opacity-70">
                {option}
              </button>
            ))}
          </div>
          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        </div>
      </OnboardingFrame>
    );
  }

  return (
    <OnboardingFrame step="3 of 3" backHref="/dashboard/community/welcome/levels" action={<span className="block h-14" />}>
      <div>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold text-[#6B5F8A]">Level</span>
          <span className={remaining <= 20 ? "font-bold text-red-600" : "text-[#6B5F8A]"}>{remaining}s</span>
        </div>
        <div className="mb-4 h-1.5 rounded-full bg-[#E7E0F4]">
          <div className="h-1.5 rounded-full bg-[#7C3AED]" style={{ width: `${((120 - remaining) / 120) * 100}%` }} />
        </div>
        <h1 className="font-heading text-2xl font-extrabold">{item.prompt}</h1>
        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={() => playClip(item.audioUrl)} className="flex h-16 w-16 items-center justify-center rounded-full bg-[#7C3AED] text-sm font-bold text-white">
            Play
          </button>
          {item.roman ? (
            <button type="button" className="min-h-11 text-sm font-semibold text-[#7C3AED]" onClick={() => setShowWords((value) => !value)}>
              {showWords ? "Hide words" : "Show words"}
            </button>
          ) : null}
        </div>
        {showWords && item.roman ? <p className="mt-2 text-sm text-[#4A3F66]">{item.roman}</p> : null}
        <div className="mt-4 space-y-2">
          {item.options.map((option) => {
            const tone = correctId == null ? "bg-white" : option.id === correctId ? "bg-emerald-100" : option.id === picked ? "bg-red-100" : "bg-white";
            return (
              <div key={option.id} className="flex items-center gap-2">
                {option.audioUrl ? (
                  <button type="button" aria-label="Play this answer" onClick={() => playClip(option.audioUrl)} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#F1ECFF] text-xs font-bold text-[#5B21B6]">
                    Play
                  </button>
                ) : null}
                <button type="button" disabled={picked != null} onClick={() => void chooseOption(option.id)} className={`flex h-14 w-full items-center rounded-[18px] px-4 text-left text-[16px] font-semibold active:scale-[0.99] disabled:opacity-80 ${tone}`}>
                  {option.label}
                </button>
              </div>
            );
          })}
        </div>
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      </div>
    </OnboardingFrame>
  );
}
