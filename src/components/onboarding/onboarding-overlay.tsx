"use client";

import { useMemo, useState } from "react";
import { completeOnboarding } from "@/app/dashboard/onboarding/actions";
import { TabBarPreview } from "@/components/onboarding/tab-bar-preview";
import { GAME_CATALOG } from "@/lib/games/catalog";
import { GOAL_MOTIVATIONS, serializeMotivationIds } from "@/lib/progression/motivations";
import { PROGRESSION_TIERS, getTierByNumber } from "@/lib/progression/tiers";

const TOTAL_SCREENS = 8;

type OnboardingOverlayProps = {
  isTestMode: boolean;
  onClose: () => void;
};

type ScreenContent = {
  title: string;
  body?: string | string[];
  visual?: "welcome" | "tabs" | "lessons" | "games" | "streaks" | "tiers-list";
};

const INFO_SCREENS: ScreenContent[] = [
  {
    title: "Welcome to Kidda",
    body: "Let's show you around in under a minute.",
    visual: "welcome",
  },
  {
    title: "Your five main tabs",
    visual: "tabs",
  },
  {
    title: "Lessons and course access",
    body: [
      "Lessons are organised by week within each course.",
      "Free starter lessons are available straight away. Full courses unlock when you purchase them — you can jump to any week inside a course you own; progress isn't gated week-by-week.",
    ],
    visual: "lessons",
  },
  {
    title: "Games for practice",
    body: [
      `Under the Games tab you'll find Vocabulary Games and Grammar Games — ${GAME_CATALOG.length} ways to practice, including Match, Speed Translate, Conjugation Challenge, and Sentence Builder.`,
      "Games earn XP toward your next level-up test alongside lessons and quizzes.",
    ],
    visual: "games",
  },
  {
    title: "Keep your streak going",
    body: [
      "A streak counts consecutive days you learn in the app.",
      "Miss one day? You get a one-day grace redemption — complete an activity the next day to keep your streak alive.",
    ],
    visual: "streaks",
  },
];

function ProgressBar({ step }: { step: number }) {
  const pct = ((step + 1) / TOTAL_SCREENS) * 100;
  return (
    <div className="space-y-2">
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200">
        <div
          className="h-full rounded-full bg-violet-600 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-center text-xs text-zinc-500">
        {step + 1} of {TOTAL_SCREENS}
      </p>
    </div>
  );
}

function VisualPanel({ kind }: { kind: ScreenContent["visual"] }) {
  if (kind === "welcome") {
    return (
      <div className="flex h-40 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-violet-50 text-5xl">
        👋
      </div>
    );
  }

  if (kind === "tabs") return <TabBarPreview />;

  if (kind === "lessons") {
    return (
      <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 text-center">
        <p className="text-sm font-semibold text-violet-800">Week 1 → Week 2 → Week 3 …</p>
        <p className="mt-2 text-xs text-violet-700">Structured courses, your own pace</p>
      </div>
    );
  }

  if (kind === "games") {
    return (
      <div className="grid grid-cols-2 gap-2">
        {GAME_CATALOG.slice(0, 4).map((game) => (
          <div
            key={game.type}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800"
          >
            {game.emoji} {game.title}
          </div>
        ))}
      </div>
    );
  }

  if (kind === "streaks") {
    return (
      <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-center">
        <p className="text-3xl font-bold text-orange-600">🔥 5</p>
        <p className="mt-1 text-sm text-orange-800">day streak</p>
      </div>
    );
  }

  if (kind === "tiers-list") {
    return (
      <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
        {PROGRESSION_TIERS.map((tier) => (
          <li key={tier.tier}>
            <span className="font-semibold text-zinc-800">
              {tier.tier}. {tier.name}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  return null;
}

type TierQuestPhase = "current" | "target";

function tierRowClass(tier: number, selfTier: number | null, targetTier: number | null): string {
  const isCurrent = selfTier === tier;
  const isTarget = targetTier === tier;

  if (isCurrent && isTarget) {
    return "border-violet-400 bg-gradient-to-r from-violet-50 to-emerald-50 ring-1 ring-violet-200";
  }
  if (isCurrent) {
    return "border-violet-500 bg-violet-50 ring-1 ring-violet-200";
  }
  if (isTarget) {
    return "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-200";
  }
  return "border-zinc-200 bg-white hover:border-zinc-300";
}

export function OnboardingOverlay({ isTestMode, onClose }: OnboardingOverlayProps) {
  const [step, setStep] = useState(0);
  const [selfTier, setSelfTier] = useState<number | null>(null);
  const [targetTier, setTargetTier] = useState<number | null>(null);
  const [tierQuestPhase, setTierQuestPhase] = useState<TierQuestPhase>("current");
  const [motivations, setMotivations] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const screen = useMemo(() => {
    if (step < INFO_SCREENS.length) return INFO_SCREENS[step];
    if (step === 5) {
      return {
        title:
          tierQuestPhase === "current"
            ? "Where are you starting from?"
            : "Now select where you'd like to be",
      };
    }
    if (step === 6) return { title: "Why do you want to level up?" };
    return { title: "Your level" };
  }, [step, tierQuestPhase]);

  const canAdvance = useMemo(() => {
    if (step === 5) {
      return (
        selfTier != null &&
        targetTier != null &&
        targetTier >= selfTier
      );
    }
    if (step === 6) return motivations.length > 0;
    return true;
  }, [step, selfTier, targetTier, motivations.length]);

  function handleTierSelect(tier: number) {
    if (tierQuestPhase === "current") {
      setSelfTier(tier);
      setTargetTier((prev) => (prev != null && prev < tier ? null : prev));
      setTierQuestPhase("target");
      return;
    }

    if (selfTier == null) {
      setSelfTier(tier);
      setTierQuestPhase("target");
      return;
    }

    if (tier < selfTier) {
      setSelfTier(tier);
      setTargetTier(null);
      setTierQuestPhase("target");
      return;
    }

    setTargetTier(tier);
  }

  function toggleMotivation(id: string) {
    setMotivations((prev) =>
      prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]
    );
  }

  async function finish(dismissed: boolean) {
    setSaving(true);
    await completeOnboarding({
      isTestMode,
      selfAssessedStartingTier: dismissed ? undefined : (selfTier ?? undefined),
      statedGoalMotivation: dismissed ? undefined : serializeMotivationIds(motivations),
      targetTier: dismissed ? undefined : (targetTier ?? undefined),
    });
    setSaving(false);

    if (!isTestMode && !dismissed && selfTier != null) {
      window.location.href = "/dashboard/placement";
      return;
    }

    onClose();
  }

  async function handleNext() {
    if (step >= TOTAL_SCREENS - 1) {
      await finish(false);
      return;
    }
    if (step === 5 && tierQuestPhase === "current") {
      return;
    }
    setStep((current) => current + 1);
  }

  const selfTierMeta = selfTier ? getTierByNumber(selfTier) : null;
  const targetTierMeta = targetTier ? getTierByNumber(targetTier) : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-zinc-900/60 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          {isTestMode && (
            <span className="text-xs font-medium text-violet-600">Admin preview</span>
          )}
          {!isTestMode && <span />}
          <button
            type="button"
            onClick={() => void finish(true)}
            disabled={saving}
            className="text-sm font-medium text-zinc-500 hover:text-zinc-800"
          >
            Skip
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <ProgressBar step={step} />

          <div className="mt-6 space-y-4">
            <h2 className="text-xl font-bold text-zinc-900">{screen.title}</h2>

            {step < INFO_SCREENS.length && (
              <>
                {INFO_SCREENS[step].body && (
                  <div className="space-y-2 text-sm leading-relaxed text-zinc-600">
                    {(Array.isArray(INFO_SCREENS[step].body)
                      ? INFO_SCREENS[step].body
                      : [INFO_SCREENS[step].body]
                    ).map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                )}
                <VisualPanel kind={INFO_SCREENS[step].visual} />
              </>
            )}

            {step === 5 && (
              <div className="space-y-3">
                {selfTier != null && tierQuestPhase === "target" && (
                  <p className="text-sm text-zinc-600">
                    <span className="font-medium text-violet-700">Purple</span> is where you
                    are now. Pick a{" "}
                    <span className="font-medium text-emerald-700">green</span> goal at or
                    above that level.
                  </p>
                )}

                <div className="space-y-2">
                  {PROGRESSION_TIERS.map((tier) => {
                    const isCurrent = selfTier === tier.tier;
                    const isTarget = targetTier === tier.tier;
                    const disabled =
                      tierQuestPhase === "target" &&
                      selfTier != null &&
                      tier.tier < selfTier &&
                      !isCurrent;

                    return (
                      <button
                        key={tier.tier}
                        type="button"
                        disabled={disabled}
                        onClick={() => handleTierSelect(tier.tier)}
                        className={`w-full rounded-xl border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${tierRowClass(
                          tier.tier,
                          selfTier,
                          targetTier
                        )}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-zinc-900">
                              {tier.tier}. {tier.name}
                            </p>
                            <p className="mt-0.5 text-sm text-zinc-600">{tier.description}</p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            {isCurrent && (
                              <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                You
                              </span>
                            )}
                            {isTarget && (
                              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                Goal
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <p className="text-xs text-zinc-500">
                  We&apos;ll confirm your starting level with a short placement test next — your
                  level only changes when you pass a level-up test.
                </p>
              </div>
            )}

            {step === 6 && (
              <div className="space-y-3">
                <p className="text-sm text-zinc-600">Select all that apply.</p>
                <div className="space-y-2">
                  {GOAL_MOTIVATIONS.map((option) => {
                    const selected = motivations.includes(option.id);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => toggleMotivation(option.id)}
                        className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                          selected
                            ? "border-violet-400 bg-violet-50 font-medium text-violet-900"
                            : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs ${
                              selected
                                ? "border-violet-600 bg-violet-600 text-white"
                                : "border-zinc-300 bg-white"
                            }`}
                            aria-hidden="true"
                          >
                            {selected ? "✓" : ""}
                          </span>
                          {option.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 7 && (
              <div className="space-y-4">
                <VisualPanel kind="tiers-list" />
                {selfTierMeta && targetTierMeta && (
                  <p className="rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-900">
                    From <span className="font-semibold">{selfTierMeta.name}</span> to{" "}
                    <span className="font-semibold text-emerald-800">{targetTierMeta.name}</span>
                    {motivations.length > 0 ? " — we've got your goals." : "."}
                  </p>
                )}
                {selfTierMeta && (
                  <p className="text-sm leading-relaxed text-zinc-700">
                    {selfTierMeta.tier === 1
                      ? "Next up: the Level 1 → 2 check. Pass with 95%+ and you'll start at Level 2 — otherwise we'll confirm Level 1."
                      : `Next up: a short placement test to confirm Level ${selfTierMeta.tier} (${selfTierMeta.name}) is the right starting point.`}
                  </p>
                )}
                <p className="text-sm leading-relaxed text-zinc-600">
                  Earn XP from lessons, quizzes, games, and flashcards to unlock level-up tests.
                  Your level only goes up when you pass a test — it never drops.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-zinc-100 px-5 py-4">
          <button
            type="button"
            onClick={() => void handleNext()}
            disabled={!canAdvance || saving}
            className="w-full rounded-xl bg-violet-600 px-4 py-3.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {step >= TOTAL_SCREENS - 1 ? "Start placement" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
