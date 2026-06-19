"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type CompleteOnboardingInput = {
  selfAssessedStartingTier?: number;
  statedGoalMotivation?: string;
  targetTier?: number;
  isTestMode?: boolean;
};

export async function completeOnboarding(input: CompleteOnboardingInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not signed in." };

  const updates: Record<string, unknown> = {};

  if (!input.isTestMode) {
    updates.has_seen_onboarding = true;
  }

  if (input.selfAssessedStartingTier != null) {
    updates.self_assessed_starting_tier = input.selfAssessedStartingTier;
  }
  if (input.statedGoalMotivation) {
    updates.stated_goal_motivation = input.statedGoalMotivation;
  }
  if (input.targetTier != null) {
    updates.target_tier = input.targetTier;
  }

  const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/home");
  revalidatePath("/dashboard/profile");

  return { success: true };
}
