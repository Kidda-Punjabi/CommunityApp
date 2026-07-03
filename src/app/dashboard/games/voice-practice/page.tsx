import { VoicePracticeMode } from "@/components/games/voice-practice-mode";
import { loadGrammarSentencesForGames } from "@/lib/games/load-grammar-sentences";
import { createClient } from "@/lib/supabase/server";

export default async function VoicePracticePage() {
  const supabase = await createClient();
  const { sentences, tableReady, loadError } = await loadGrammarSentencesForGames(supabase);

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <VoicePracticeMode
        sentences={sentences}
        tableReady={tableReady}
        loadError={loadError}
      />
    </div>
  );
}
