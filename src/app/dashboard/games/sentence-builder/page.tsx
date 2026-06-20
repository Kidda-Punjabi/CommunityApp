import { SentenceBuilderMode } from "@/components/games/sentence-builder-mode";
import { loadChallengeForGamePage } from "@/lib/challenges/load-challenge-for-page";
import { loadGrammarSentencesForGames } from "@/lib/games/load-grammar-sentences";
import { createClient } from "@/lib/supabase/server";

type SentenceBuilderPageProps = {
  searchParams: Promise<{ challenge?: string }>;
};

export default async function SentenceBuilderPage({ searchParams }: SentenceBuilderPageProps) {
  const supabase = await createClient();
  const [{ sentences, tableReady, loadError }, challenge] = await Promise.all([
    loadGrammarSentencesForGames(supabase),
    loadChallengeForGamePage(searchParams),
  ]);

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <SentenceBuilderMode
        sentences={sentences}
        tableReady={tableReady}
        loadError={loadError}
        challenge={challenge}
      />
    </div>
  );
}
