import { redirect } from "next/navigation";
import { PlacementFlow } from "@/components/progression/placement-flow";
import { loadLevelTestQuestions } from "@/lib/progression/level-test-service";
import type { LevelTestQuestion } from "@/lib/progression/level-tests";
import { loadOnboardingProfile } from "@/lib/progression/load-user-progression";
import { createClient } from "@/lib/supabase/server";

export default async function PlacementPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const profile = await loadOnboardingProfile(supabase, user.id);

  if (profile.placementCompleted) {
    redirect("/dashboard/profile");
  }

  const fromLevels = [1, 2, 3, 4, 5, 6, 7];
  const pools = await Promise.all(
    fromLevels.map(async (fromLevel) => ({
      fromLevel,
      questions: await loadLevelTestQuestions(supabase, fromLevel).catch(() => []),
    }))
  );

  const questionPools: Record<number, LevelTestQuestion[]> = {};
  for (const { fromLevel, questions } of pools) {
    questionPools[fromLevel] = questions;
  }

  return (
    <PlacementFlow
      initialClaimedLevel={profile.selfAssessedStartingTier}
      questionPools={questionPools}
    />
  );
}
