import { SentenceBuilderMode } from "@/components/games/sentence-builder-mode";
import { loadGenderedNouns } from "@/lib/conjugation/load-gendered-nouns";
import { loadVerbs } from "@/lib/conjugation/load-verbs";
import { createClient } from "@/lib/supabase/server";

export default async function SentenceBuilderPage() {
  const supabase = await createClient();
  const [{ verbs, tableReady: verbsReady }, { nouns, tableReady: nounsReady }] =
    await Promise.all([loadVerbs(supabase), loadGenderedNouns(supabase)]);

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <SentenceBuilderMode
        verbs={verbs}
        nouns={nouns}
        verbsReady={verbsReady}
        nounsReady={nounsReady}
      />
    </div>
  );
}
