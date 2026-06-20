import { SentenceBuilderMode } from "@/components/games/sentence-builder-mode";
import { loadGrammarSentencesForGames } from "@/lib/games/load-grammar-sentences";
import { createClient } from "@/lib/supabase/server";

export default async function SentenceBuilderPage() {
  const supabase = await createClient();
  const { sentences, tableReady, loadError } = await loadGrammarSentencesForGames(supabase);

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <SentenceBuilderMode
        sentences={sentences}
        tableReady={tableReady}
        loadError={loadError}
      />
    </div>
  );
}
