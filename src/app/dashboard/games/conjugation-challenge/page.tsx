import { ConjugationChallengeMode } from "@/components/games/conjugation-challenge-mode";
import { fetchAccessibleVerbs } from "@/lib/games/grammar-access";
import { fetchPersonalBest } from "@/lib/games/game-scores";
import type { VerbConjugation } from "@/lib/games/types";
import { getCourseAccessContext } from "@/lib/membership/unlocked";
import { createClient } from "@/lib/supabase/server";

export default async function ConjugationChallengePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const access = await getCourseAccessContext(supabase, user!);
  const rows = await fetchAccessibleVerbs(supabase, access.unlockedCourseIds);
  const verbs = rows as VerbConjugation[];
  const best = await fetchPersonalBest(supabase, user!.id, "conjugation_challenge");

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <ConjugationChallengeMode verbs={verbs} initialBestScore={best ?? 0} />
    </div>
  );
}
