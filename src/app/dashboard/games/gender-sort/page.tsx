import { GenderSortMode } from "@/components/games/gender-sort-mode";
import { fetchAccessibleGenderedNouns } from "@/lib/games/grammar-access";
import { fetchPersonalBest } from "@/lib/games/game-scores";
import type { GenderedNoun } from "@/lib/games/types";
import { getCourseAccessContext } from "@/lib/membership/unlocked";
import { createClient } from "@/lib/supabase/server";

export default async function GenderSortPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const access = await getCourseAccessContext(supabase, user!);
  const rows = await fetchAccessibleGenderedNouns(supabase, access.unlockedCourseIds);
  const nouns = rows as GenderedNoun[];
  const best = await fetchPersonalBest(supabase, user!.id, "gender_sort");

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <GenderSortMode nouns={nouns} initialBestScore={best ?? 0} />
    </div>
  );
}
