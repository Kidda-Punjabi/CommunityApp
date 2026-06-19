import { VerbConjugatorQuiz } from "@/components/resources/verb-conjugator/verb-quiz";
import { loadVerbs } from "@/lib/conjugation/load-verbs";
import { createClient } from "@/lib/supabase/server";

export default async function VerbConjugatorQuizPage() {
  const supabase = await createClient();
  const { verbs } = await loadVerbs(supabase);

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <VerbConjugatorQuiz verbs={verbs} />
    </div>
  );
}
