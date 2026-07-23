import { VoicePracticeMode } from "@/components/games/voice-practice-mode";
import { loadGrammarSentencesForGames } from "@/lib/games/load-grammar-sentences";
import { attemptsFromCount, loadVoicePracticeAttempts } from "@/lib/games/voice-practice-stt";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{ catchupReturn?: string }>;
};

export default async function VoicePracticePage({ searchParams }: PageProps) {
  const { catchupReturn } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ sentences, tableReady, loadError }, initialAttempts] = await Promise.all([
    loadGrammarSentencesForGames(supabase),
    user ? loadVoicePracticeAttempts(supabase, user.id) : Promise.resolve(attemptsFromCount(0)),
  ]);

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <VoicePracticeMode
        sentences={sentences}
        initialAttempts={initialAttempts}
        tableReady={tableReady}
        loadError={loadError}
        catchupReturn={catchupReturn ?? null}
      />
    </div>
  );
}
