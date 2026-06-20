import { StreakSurvivalMode } from "@/components/games/streak-survival-mode";
import { loadChallengeForGamePage } from "@/lib/challenges/load-challenge-for-page";
import { fetchAccessibleGenderedNouns } from "@/lib/games/grammar-access";
import { fetchPersonalBest } from "@/lib/games/game-scores";
import { getCourseAccessContext } from "@/lib/membership/unlocked";
import { createClient } from "@/lib/supabase/server";

type StreakSurvivalGenderPageProps = {
  searchParams: Promise<{ challenge?: string }>;
};

export default async function StreakSurvivalGenderPage({
  searchParams,
}: StreakSurvivalGenderPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [access, challenge, best] = await Promise.all([
    getCourseAccessContext(supabase, user!),
    loadChallengeForGamePage(searchParams),
    fetchPersonalBest(supabase, user!.id, "streak_survival"),
  ]);
  const nouns = await fetchAccessibleGenderedNouns(supabase, access.unlockedCourseIds);

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <StreakSurvivalMode
        sourceType="gender"
        nouns={nouns}
        initialBestScore={best ?? 0}
        backHref="/dashboard/games/streak-survival"
        challenge={challenge}
      />
    </div>
  );
}
