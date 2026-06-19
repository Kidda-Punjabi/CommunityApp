import { VerbConjugatorPicker } from "@/components/resources/verb-conjugator/verb-picker";
import { loadVerbs } from "@/lib/conjugation/load-verbs";
import { createClient } from "@/lib/supabase/server";

export default async function VerbConjugatorPage() {
  const supabase = await createClient();
  const { verbs, tableReady } = await loadVerbs(supabase);

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <VerbConjugatorPicker verbs={verbs} tableReady={tableReady} />
    </div>
  );
}
