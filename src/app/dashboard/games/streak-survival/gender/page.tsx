import { StreakSurvivalMode } from "@/components/games/streak-survival-mode";
import { fetchAccessibleGenderedNouns } from "@/lib/games/grammar-access";
import { fetchPersonalBest } from "@/lib/games/game-scores";
import { getCourseAccessContext } from "@/lib/membership/unlocked";
import { createClient } from "@/lib/supabase/server";

export default async function StreakSurvivalGenderPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const access = await getCourseAccessContext(supabase, user!);
  const nouns = await fetchAccessibleGenderedNouns(supabase, access.unlockedCourseIds);
  const best = await fetchPersonalBest(supabase, user!.id, "streak_survival");

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <StreakSurvivalMode
        sourceType="gender"
        nouns={nouns}
        initialBestScore={best ?? 0}
        backHref="/dashboard/games/streak-survival"
      />
    </div>
  );
}
