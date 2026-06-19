import { ConjugationChallengeMode } from "@/components/games/conjugation-challenge-mode";
import { loadVerbs } from "@/lib/conjugation/load-verbs";
import { createClient } from "@/lib/supabase/server";

export default async function ConjugationChallengePage() {
  const supabase = await createClient();
  const { verbs, tableReady } = await loadVerbs(supabase);

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <ConjugationChallengeMode verbs={verbs} tableReady={tableReady} />
    </div>
  );
}
