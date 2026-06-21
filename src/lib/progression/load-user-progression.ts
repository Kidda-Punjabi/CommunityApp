import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isTestUnlocked,
  xpProgressToNextTest,
  xpRequiredForTest,
} from "@/lib/progression/xp-thresholds";
import {
  loadLatestTestAttempt,
  whatsNextGuidance,
  type LevelTestAttemptSummary,
} from "@/lib/progression/level-test-service";
import { formatMotivationLabels } from "./motivations";
import { getNextTier, getTierByNumber, type ProgressionTier } from "./tiers";

export type UserProgression = {
  learnerLevel: number | null;
  tier: ProgressionTier | null;
  nextTier: ProgressionTier | null;
  totalXp: number;
  placementCompleted: boolean;
  xpProgress: ReturnType<typeof xpProgressToNextTest>;
  testUnlocked: boolean;
  xpRequiredForNextTest: number | null;
  latestTestAttempt: LevelTestAttemptSummary | null;
  whatsNext: ReturnType<typeof whatsNextGuidance>;
  selfAssessedTier: number | null;
  targetTier: number | null;
  targetTierMeta: ProgressionTier | null;
  goalMotivation: string | null;
  goalMotivationLabel: string | null;
};

export type OnboardingProfile = {
  hasSeenOnboarding: boolean;
  selfAssessedStartingTier: number | null;
  statedGoalMotivation: string | null;
  targetTier: number | null;
  placementCompleted: boolean;
  learnerLevel: number | null;
};

export async function loadOnboardingProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<OnboardingProfile> {
  const { data } = await supabase
    .from("profiles")
    .select(
      "has_seen_onboarding, self_assessed_starting_tier, stated_goal_motivation, target_tier, placement_completed_at, learner_level"
    )
    .eq("id", userId)
    .single();

  return {
    hasSeenOnboarding: data?.has_seen_onboarding ?? false,
    selfAssessedStartingTier: data?.self_assessed_starting_tier ?? null,
    statedGoalMotivation: data?.stated_goal_motivation ?? null,
    targetTier: data?.target_tier ?? null,
    placementCompleted: Boolean(data?.placement_completed_at),
    learnerLevel: data?.learner_level ?? null,
  };
}

export async function loadUserProgression(
  supabase: SupabaseClient,
  userId: string
): Promise<UserProgression> {
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "self_assessed_starting_tier, stated_goal_motivation, target_tier, learner_level, total_xp, xp_at_level_start, placement_completed_at"
    )
    .eq("id", userId)
    .single();

  const learnerLevel = profile?.learner_level ?? null;
  const totalXp = profile?.total_xp ?? 0;
  const xpAtLevelStart = profile?.xp_at_level_start ?? 0;
  const placementCompleted = Boolean(profile?.placement_completed_at);
  const tier = learnerLevel != null ? getTierByNumber(learnerLevel) : null;
  const nextTier = learnerLevel != null ? getNextTier(learnerLevel) : null;

  const latestTestAttempt =
    learnerLevel != null && learnerLevel < 8
      ? await loadLatestTestAttempt(supabase, userId, learnerLevel)
      : null;

  const testUnlocked =
    learnerLevel != null
      ? isTestUnlocked(learnerLevel, totalXp, xpAtLevelStart)
      : false;

  const xpProgress =
    learnerLevel != null
      ? xpProgressToNextTest(learnerLevel, totalXp, xpAtLevelStart)
      : null;

  const targetTier = profile?.target_tier ?? null;

  return {
    learnerLevel,
    tier,
    nextTier,
    totalXp,
    placementCompleted,
    xpProgress,
    testUnlocked,
    xpRequiredForNextTest:
      learnerLevel != null ? xpRequiredForTest(learnerLevel) : null,
    latestTestAttempt,
    whatsNext: whatsNextGuidance({
      learnerLevel,
      placementCompleted,
      totalXp,
      xpAtLevelStart,
      testUnlocked,
      latestAttempt: latestTestAttempt,
    }),
    selfAssessedTier: profile?.self_assessed_starting_tier ?? null,
    targetTier,
    targetTierMeta: targetTier ? getTierByNumber(targetTier) : null,
    goalMotivation: profile?.stated_goal_motivation ?? null,
    goalMotivationLabel: formatMotivationLabels(profile?.stated_goal_motivation),
  };
}
