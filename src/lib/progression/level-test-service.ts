import type { SupabaseClient } from "@supabase/supabase-js";
import {
  LEVEL_TEST_PASS_PCT,
  type LevelTestQuestion,
} from "@/lib/progression/level-tests";
import { parseLevelTestQuestion } from "@/lib/progression/parse-level-test-question";
import { xpRemainingForTest } from "@/lib/progression/xp-thresholds";
import { getTierByNumber } from "@/lib/progression/tiers";

export type LevelTestAttemptSummary = {
  fromLevel: number;
  scorePct: number;
  passed: boolean;
  correctCount: number;
  totalCount: number;
  createdAt: string;
};

export async function loadLevelTestQuestions(
  supabase: SupabaseClient,
  fromLevel: number
): Promise<LevelTestQuestion[]> {
  const { data, error } = await supabase
    .from("level_test_questions")
    .select(
      "id, from_level, question_type, content, question_text, option_a, option_b, option_c, option_d, correct_answer, question_order"
    )
    .eq("from_level", fromLevel)
    .eq("active", true)
    .order("question_order", { ascending: true });

  if (error) throw error;
  return (data ?? [])
    .map((row) => parseLevelTestQuestion(row as Record<string, unknown>))
    .filter((question): question is LevelTestQuestion => question !== null);
}

export async function loadLatestTestAttempt(
  supabase: SupabaseClient,
  userId: string,
  fromLevel: number
): Promise<LevelTestAttemptSummary | null> {
  const { data, error } = await supabase
    .from("level_test_attempts")
    .select("from_level, score_pct, passed, correct_count, total_count, created_at")
    .eq("user_id", userId)
    .eq("from_level", fromLevel)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    fromLevel: data.from_level,
    scorePct: data.score_pct,
    passed: data.passed,
    correctCount: data.correct_count,
    totalCount: data.total_count,
    createdAt: data.created_at,
  };
}

export type RecordAttemptResult = {
  attemptId: string;
  scorePct: number;
  passed: boolean;
  learnerLevel: number | null;
};

export async function recordLevelTestAttempt(
  supabase: SupabaseClient,
  options: {
    fromLevel: number;
    correctCount: number;
    totalCount: number;
    isPlacement?: boolean;
    setLevelOnPass?: boolean;
  }
): Promise<RecordAttemptResult> {
  const { data, error } = await supabase.rpc("record_level_test_attempt", {
    p_from_level: options.fromLevel,
    p_correct_count: options.correctCount,
    p_total_count: options.totalCount,
    p_is_placement: options.isPlacement ?? false,
    p_set_level_on_pass: options.setLevelOnPass ?? true,
  });

  if (error) throw error;

  const result = data as {
    attempt_id: string;
    score_pct: number;
    passed: boolean;
    learner_level: number | null;
  };

  return {
    attemptId: result.attempt_id,
    scorePct: result.score_pct,
    passed: result.passed,
    learnerLevel: result.learner_level,
  };
}

export async function beginPlacement(
  supabase: SupabaseClient,
  claimedLevel: number
): Promise<void> {
  const { error } = await supabase.rpc("begin_placement", {
    p_claimed_level: claimedLevel,
  });
  if (error) throw error;
}

export async function completePlacement(
  supabase: SupabaseClient
): Promise<number> {
  const { data, error } = await supabase.rpc("complete_placement");
  if (error) throw error;

  const result = data as { placed_level: number };
  return result.placed_level;
}

export function whatsNextGuidance(options: {
  learnerLevel: number | null;
  placementCompleted: boolean;
  totalXp: number;
  xpAtLevelStart: number;
  testUnlocked: boolean;
  latestAttempt: LevelTestAttemptSummary | null;
}): { headline: string; detail: string; actionHref?: string; actionLabel?: string } {
  if (!options.placementCompleted || options.learnerLevel == null) {
    return {
      headline: "Complete your placement",
      detail: "Take a short assessment so we can show your level and recommend the right content.",
      actionHref: "/dashboard/placement",
      actionLabel: "Start placement",
    };
  }

  if (options.learnerLevel >= 8) {
    return {
      headline: "You've reached the top level",
      detail: "Keep practicing in the app and join Community sessions to stay fluent.",
    };
  }

  if (options.testUnlocked) {
    if (options.latestAttempt && !options.latestAttempt.passed) {
      return {
        headline: `${getTierByNumber(options.learnerLevel + 1).name} test available`,
        detail: `Last attempt: ${options.latestAttempt.scorePct}% — need ${LEVEL_TEST_PASS_PCT}%+ to pass.`,
        actionHref: `/dashboard/level-test/${options.learnerLevel}`,
        actionLabel: "Try again",
      };
    }

    return {
      headline: `Level ${options.learnerLevel + 1} test available`,
      detail: "You've earned enough XP at this level — take the test when you're ready.",
      actionHref: `/dashboard/level-test/${options.learnerLevel}`,
      actionLabel: "Take level-up test",
    };
  }

  const remaining = xpRemainingForTest(
    options.learnerLevel,
    options.totalXp,
    options.xpAtLevelStart
  );
  return {
    headline: `Earn XP to unlock the Level ${options.learnerLevel + 1} test`,
    detail: `Earn ${remaining} more XP at Level ${options.learnerLevel} (${options.totalXp} XP lifetime so far).`,
  };
}
