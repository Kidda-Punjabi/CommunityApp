"use client";

import { useMemo, useState } from "react";
import { completeOnboarding } from "@/app/dashboard/onboarding/actions";
import { TabBarPreview } from "@/components/onboarding/tab-bar-preview";
import { GAME_CATALOG } from "@/lib/games/catalog";
import { GOAL_MOTIVATIONS } from "@/lib/progression/motivations";
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

export function OnboardingOverlay({ isTestMode, onClose }: OnboardingOverlayProps) {
  const [step, setStep] = useState(0);
  const [selfTier, setSelfTier] = useState<number | null>(null);
  const [motivation, setMotivation] = useState<string | null>(null);
  const [targetTier, setTargetTier] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const screen = useMemo(() => {
    if (step < INFO_SCREENS.length) return INFO_SCREENS[step];
    if (step === 5) return { title: "Where are you starting from?" };
    if (step === 6) return { title: "What's your goal with Punjabi?" };
    return { title: "Your level" };
  }, [step]);

  const canAdvance = useMemo(() => {
    if (step === 5) return selfTier != null;
    if (step === 6) return motivation != null && targetTier != null;
    return true;
  }, [step, selfTier, motivation, targetTier]);

  async function finish(dismissed: boolean) {
    setSaving(true);
    await completeOnboarding({
      isTestMode,
      selfAssessedStartingTier: dismissed ? undefined : (selfTier ?? undefined),
      statedGoalMotivation: dismissed ? undefined : (motivation ?? undefined),
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
    setStep((current) => current + 1);
  }

  const targetTierMeta = targetTier ? getTierByNumber(targetTier) : null;
  const selfTierMeta = selfTier ? getTierByNumber(selfTier) : null;

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
                <div className="space-y-2">
                  {PROGRESSION_TIERS.map((tier) => (
                    <button
                      key={tier.tier}
                      type="button"
                      onClick={() => setSelfTier(tier.tier)}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                        selfTier === tier.tier
                          ? "border-violet-400 bg-violet-50"
                          : "border-zinc-200 bg-white hover:border-zinc-300"
                      }`}
                    >
                      <p className="font-semibold text-zinc-900">
                        {tier.tier}. {tier.name}
                      </p>
                      <p className="mt-0.5 text-sm text-zinc-600">{tier.description}</p>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-zinc-500">
                  We&apos;ll confirm this with a short placement test next — your level only
                  changes when you pass a level-up test.
                </p>
              </div>
            )}

            {step === 6 && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-zinc-700">What brings you here?</p>
                  {GOAL_MOTIVATIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setMotivation(option.id)}
                      className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                        motivation === option.id
                          ? "border-violet-400 bg-violet-50 font-medium text-violet-900"
                          : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-zinc-700">Where would you like to get to?</p>
                  {PROGRESSION_TIERS.map((tier) => (
                    <button
                      key={tier.tier}
                      type="button"
                      onClick={() => setTargetTier(tier.tier)}
                      className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                        targetTier === tier.tier
                          ? "border-violet-400 bg-violet-50 font-medium text-violet-900"
                          : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                      }`}
                    >
                      {tier.tier}. {tier.name}
                    </button>
                  ))}
                </div>

                {targetTierMeta && (
                  <p className="rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-800">
                    Got it — we&apos;ll help you work toward {targetTierMeta.name}.
                  </p>
                )}
              </div>
            )}

            {step === 7 && (
              <div className="space-y-4">
                <VisualPanel kind="tiers-list" />
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
