import { SpotTheMistakeMode } from "@/components/games/spot-the-mistake-mode";
import { fetchAccessibleGenderedNouns } from "@/lib/games/grammar-access";
import { loadGrammarSentencesForGames } from "@/lib/games/load-grammar-sentences";
import { getCourseAccessContext } from "@/lib/membership/unlocked";
import { createClient } from "@/lib/supabase/server";

export default async function SpotTheMistakePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const access = await getCourseAccessContext(supabase, user!);

  const [grammarContent, genderedNouns] = await Promise.all([
    loadGrammarSentencesForGames(supabase),
    fetchAccessibleGenderedNouns(supabase, access.unlockedCourseIds),
  ]);

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <SpotTheMistakeMode
        sentences={grammarContent.sentences}
        genderedNouns={genderedNouns}
        tableReady={grammarContent.tableReady}
        loadError={grammarContent.loadError}
      />
    </div>
  );
}
