import { ConjugationChallengeMode } from "@/components/games/conjugation-challenge-mode";
import { loadChallengeForGamePage } from "@/lib/challenges/load-challenge-for-page";
import { loadGrammarSentencesForGames } from "@/lib/games/load-grammar-sentences";
import { createClient } from "@/lib/supabase/server";

type ConjugationChallengePageProps = {
  searchParams: Promise<{ challenge?: string }>;
};

export default async function ConjugationChallengePage({
  searchParams,
}: ConjugationChallengePageProps) {
  const supabase = await createClient();
  const [{ sentences, tableReady, loadError }, challenge] = await Promise.all([
    loadGrammarSentencesForGames(supabase),
    loadChallengeForGamePage(searchParams),
  ]);

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <ConjugationChallengeMode
        sentences={sentences}
        tableReady={tableReady}
        loadError={loadError}
        challenge={challenge}
      />
    </div>
  );
}
