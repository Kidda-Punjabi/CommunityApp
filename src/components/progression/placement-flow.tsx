"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { LevelTestPlayer } from "@/components/progression/level-test-player";
import {
  beginPlacement,
  completePlacement,
  recordLevelTestAttempt,
} from "@/lib/progression/level-test-service";
import {
  confirmationTestFromLevel,
  followUpTestFromLevel,
  resolvePlacementAfterFirstTest,
  resolvePlacementAfterFollowUp,
  type LevelTestQuestion,
} from "@/lib/progression/level-tests";
import { PROGRESSION_TIERS, getTierByNumber } from "@/lib/progression/tiers";
import { createClient } from "@/lib/supabase/client";
import { ui } from "@/lib/ui/styles";

type Phase =
  | "pick-level"
  | "intro"
  | "first-test"
  | "first-result"
  | "followup-test"
  | "done";

function rpcErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  if (error instanceof Error) return error.message;
  return "Could not start placement. Please try again.";
}

type PlacementFlowProps = {
  initialClaimedLevel: number | null;
  questionPools: Record<number, LevelTestQuestion[]>;
};

function poolQuestions(
  pools: Record<number, LevelTestQuestion[]>,
  fromLevel: number
): LevelTestQuestion[] {
  const key = String(fromLevel);
  return (
    pools[fromLevel] ??
    (pools as Record<string, LevelTestQuestion[]>)[key] ??
    []
  );
}

export function PlacementFlow({ initialClaimedLevel, questionPools }: PlacementFlowProps) {
  const router = useRouter();
  const [claimedLevel, setClaimedLevel] = useState<number | null>(initialClaimedLevel);
  const [phase, setPhase] = useState<Phase>(initialClaimedLevel ? "intro" : "pick-level");
  const [firstScore, setFirstScore] = useState<number | null>(null);
  const [outcomeMessage, setOutcomeMessage] = useState<string>("");
  const [placedLevel, setPlacedLevel] = useState<number | null>(null);
  const [needsFollowUp, setNeedsFollowUp] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const firstFromLevel = claimedLevel ? confirmationTestFromLevel(claimedLevel) : 1;
  const followUpFromLevel = followUpTestFromLevel();
  const firstTestQuestions = poolQuestions(questionPools, firstFromLevel);

  async function finalizePlacement(message: string) {
    const supabase = createClient();
    const level = await completePlacement(supabase);
    setPlacedLevel(level);
    setOutcomeMessage(message);
    setPhase("done");
  }

  async function startFirstTest() {
    if (claimedLevel == null) return;

    setStarting(true);
    setStartError(null);

    try {
      const supabase = createClient();
      await beginPlacement(supabase, claimedLevel);
      setPhase("first-test");
    } catch (error) {
      const message = rpcErrorMessage(error);

      if (
        message.includes("begin_placement") ||
        message.includes("function") ||
        message.includes("schema cache")
      ) {
        setStartError(
          "Placement is not set up on the server yet. Run supabase/learner-progression.sql in Supabase, then refresh."
        );
      } else {
        setStartError(message);
      }
    } finally {
      setStarting(false);
    }
  }

  if (phase === "pick-level") {
    return (
      <div className={`${ui.page} ${ui.stackLoose}`}>
        <div>
          <Link href="/dashboard/profile" className="text-sm font-medium text-violet-600">
            ← Profile
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-zinc-900">Which level are you at?</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Pick the level that best describes you today. We&apos;ll confirm with a short test.
          </p>
        </div>
        <div className="space-y-2">
          {PROGRESSION_TIERS.map((tier) => (
            <button
              key={tier.tier}
              type="button"
              onClick={() => {
                setClaimedLevel(tier.tier);
                setPhase("intro");
              }}
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left hover:border-violet-300"
            >
              <p className="font-semibold text-zinc-900">
                {tier.tier}. {tier.name}
              </p>
              <p className="mt-0.5 text-sm text-zinc-600">{tier.description}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (!claimedLevel) return null;

  if (phase === "intro") {
    const testLevel = firstFromLevel + 1;
    const introDetail =
      claimedLevel === 1
        ? "We'll give you the Level 1 → 2 check. Pass with 95%+ and you'll start at Level 2 — otherwise we'll confirm Level 1 as your starting point."
        : `We'll use the Level ${firstFromLevel} → ${testLevel} check — the same format as normal level-up tests.`;
    const introLead =
      claimedLevel === 1
        ? "You said you're at the very beginning of your journey"
        : `You said you're around ${getTierByNumber(claimedLevel).name}`;
    return (
      <div className={`${ui.page} ${ui.stackLoose}`}>
        <div>
          <Link href="/dashboard/profile" className="text-sm font-medium text-violet-600">
            ← Profile
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-zinc-900">Find your starting level</h1>
          <p className="mt-2 text-sm text-zinc-600">
            {introLead}. This short test helps us find the right starting point — about 30
            questions, no time limit.
          </p>
        </div>
        <div className={ui.card}>
          <p className="text-sm text-zinc-700">{introDetail}</p>
          {firstTestQuestions.length === 0 && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Question bank not loaded yet — run{" "}
              <code className="text-xs">supabase/level-test-questions-seed.sql</code> in Supabase
              before taking this test.
            </p>
          )}
          {startError && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {startError}
            </p>
          )}
          <button
            type="button"
            onClick={() => void startFirstTest()}
            disabled={starting}
            className="mt-4 w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {starting ? "Starting…" : "Start placement test"}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "first-test") {
    return (
      <div className={ui.page}>
        <LevelTestPlayer
          fromLevel={firstFromLevel}
          questions={firstTestQuestions}
          mode="placement"
          backHref="/dashboard/placement"
          onComplete={async ({ correctCount, totalCount, scorePct }) => {
            const supabase = createClient();
            await recordLevelTestAttempt(supabase, {
              fromLevel: firstFromLevel,
              correctCount,
              totalCount,
              isPlacement: true,
              setLevelOnPass: false,
            });

            setFirstScore(scorePct);
            const outcome = resolvePlacementAfterFirstTest(claimedLevel, scorePct);
            setOutcomeMessage(outcome.message);
            setNeedsFollowUp(outcome.needsFollowUp);

            if (!outcome.needsFollowUp) {
              await finalizePlacement(outcome.message);
              return;
            }

            setPhase("first-result");
          }}
        />
      </div>
    );
  }

  if (phase === "first-result") {
    return (
      <div className={`${ui.page} ${ui.stackLoose}`}>
        <div className={ui.card}>
          <p className="text-sm text-zinc-700">{outcomeMessage}</p>
          {firstScore != null && (
            <p className="mt-2 text-sm text-zinc-500">First test score: {firstScore}%</p>
          )}
          {needsFollowUp && (
            <button
              type="button"
              onClick={() => setPhase("followup-test")}
              className="mt-4 w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
            >
              Continue with follow-up check
            </button>
          )}
        </div>
      </div>
    );
  }

  if (phase === "followup-test") {
    return (
      <div className={ui.page}>
        <LevelTestPlayer
          fromLevel={followUpFromLevel}
          questions={poolQuestions(questionPools, followUpFromLevel)}
          mode="placement"
          backHref="/dashboard/placement"
          onComplete={async ({ correctCount, totalCount }) => {
            const supabase = createClient();
            const attempt = await recordLevelTestAttempt(supabase, {
              fromLevel: followUpFromLevel,
              correctCount,
              totalCount,
              isPlacement: true,
              setLevelOnPass: false,
            });

            const outcome = resolvePlacementAfterFollowUp(attempt.passed);
            await finalizePlacement(outcome.message);
          }}
        />
      </div>
    );
  }

  return (
    <div className={`${ui.page} ${ui.stackLoose}`}>
      <div className={ui.card}>
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
          Placement complete
        </p>
        {placedLevel != null && (
          <h2 className="mt-2 text-2xl font-bold text-zinc-900">
            Level {placedLevel}: {getTierByNumber(placedLevel).name}
          </h2>
        )}
        <p className="mt-3 text-sm leading-relaxed text-zinc-600">{outcomeMessage}</p>
        <button
          type="button"
          onClick={() => router.push("/dashboard/profile")}
          className="mt-4 w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
        >
          View your profile
        </button>
      </div>
    </div>
  );
}
