import { SentenceBuilderMode } from "@/components/games/sentence-builder-mode";
import { fetchAccessibleGrammarSentences } from "@/lib/games/grammar-access";
import { fetchPersonalBest } from "@/lib/games/game-scores";
import type { GrammarSentence } from "@/lib/games/types";
import { getCourseAccessContext } from "@/lib/membership/unlocked";
import { createClient } from "@/lib/supabase/server";

export default async function SentenceBuilderPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const access = await getCourseAccessContext(supabase, user!);
  const rows = await fetchAccessibleGrammarSentences(supabase, access.unlockedCourseIds);
  const sentences = rows as GrammarSentence[];
  const best = await fetchPersonalBest(supabase, user!.id, "sentence_builder");

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <SentenceBuilderMode sentences={sentences} initialBestScore={best ?? 0} />
    </div>
  );
}
