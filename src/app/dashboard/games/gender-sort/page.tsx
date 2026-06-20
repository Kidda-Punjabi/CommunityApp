import { GenderSortMode } from "@/components/games/gender-sort-mode";
import { loadChallengeForGamePage } from "@/lib/challenges/load-challenge-for-page";
import { fetchAccessibleGenderedNouns } from "@/lib/games/grammar-access";
import { fetchPersonalBest } from "@/lib/games/game-scores";
import type { GenderedNoun } from "@/lib/games/types";
import { getCourseAccessContext } from "@/lib/membership/unlocked";
import { createClient } from "@/lib/supabase/server";

type GenderSortPageProps = {
  searchParams: Promise<{ challenge?: string }>;
};

export default async function GenderSortPage({ searchParams }: GenderSortPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [access, challenge] = await Promise.all([
    getCourseAccessContext(supabase, user!),
    loadChallengeForGamePage(searchParams),
  ]);
  const rows = await fetchAccessibleGenderedNouns(supabase, access.unlockedCourseIds);
  const nouns = rows as GenderedNoun[];
  const best = await fetchPersonalBest(supabase, user!.id, "gender_sort");

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <GenderSortMode nouns={nouns} initialBestScore={best ?? 0} challenge={challenge} />
    </div>
  );
}
