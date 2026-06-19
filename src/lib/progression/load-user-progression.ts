import type { SupabaseClient } from "@supabase/supabase-js";
import { computeUserCompetency } from "./competency";
import { getMotivationLabel } from "./motivations";
import {
  getNextTier,
  getTierByNumber,
  getTierForScore,
  scoreForSelfAssessedTier,
  type ProgressionTier,
} from "./tiers";

export type UserProgression = {
  score: number;
  tier: ProgressionTier;
  nextTier: ProgressionTier | null;
  isEstimated: boolean;
  selfAssessedTier: number | null;
  targetTier: number | null;
  targetTierMeta: ProgressionTier | null;
  goalMotivation: string | null;
  goalMotivationLabel: string | null;
  breakdown: Awaited<ReturnType<typeof computeUserCompetency>>["breakdown"];
};

export type OnboardingProfile = {
  hasSeenOnboarding: boolean;
  selfAssessedStartingTier: number | null;
  statedGoalMotivation: string | null;
  targetTier: number | null;
};

export async function loadOnboardingProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<OnboardingProfile> {
  const { data } = await supabase
    .from("profiles")
    .select(
      "has_seen_onboarding, self_assessed_starting_tier, stated_goal_motivation, target_tier"
    )
    .eq("id", userId)
    .single();

  return {
    hasSeenOnboarding: data?.has_seen_onboarding ?? false,
    selfAssessedStartingTier: data?.self_assessed_starting_tier ?? null,
    statedGoalMotivation: data?.stated_goal_motivation ?? null,
    targetTier: data?.target_tier ?? null,
  };
}

export async function loadUserProgression(
  supabase: SupabaseClient,
  userId: string
): Promise<UserProgression> {
  const [{ data: profile }, { data: lessons }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "self_assessed_starting_tier, stated_goal_motivation, target_tier, peak_competency_score"
      )
      .eq("id", userId)
      .single(),
    supabase
      .from("lessons")
      .select("id, course_id, lesson_number, pdf_url, audio_url, is_free"),
  ]);

  const computed = await computeUserCompetency(supabase, userId, lessons ?? []);
  const peakStored = profile?.peak_competency_score ?? 0;

  let score = peakStored;
  let isEstimated = false;

  if (computed.breakdown.hasRealEvidence) {
    score = Math.max(peakStored, computed.rawScore);
    if (score > peakStored) {
      await supabase
        .from("profiles")
        .update({ peak_competency_score: score })
        .eq("id", userId);
    }
  } else if (profile?.self_assessed_starting_tier) {
    score = scoreForSelfAssessedTier(profile.self_assessed_starting_tier);
    isEstimated = true;
  }

  const tier = getTierForScore(score);
  const nextTier = getNextTier(tier.tier);
  const targetTier = profile?.target_tier ?? null;

  return {
    score,
    tier,
    nextTier,
    isEstimated,
    selfAssessedTier: profile?.self_assessed_starting_tier ?? null,
    targetTier,
    targetTierMeta: targetTier ? getTierByNumber(targetTier) : null,
    goalMotivation: profile?.stated_goal_motivation ?? null,
    goalMotivationLabel: getMotivationLabel(profile?.stated_goal_motivation),
    breakdown: computed.breakdown,
  };
}
