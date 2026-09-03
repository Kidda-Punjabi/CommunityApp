import { VowelMatchMode } from "@/components/games/vowel-match-mode";
import { loadVowelMatchWords } from "@/lib/games/load-vowel-match";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function VowelMatchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { words, loadError } = await loadVowelMatchWords(supabase);

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <VowelMatchMode words={words} loadError={loadError} />
    </div>
  );
}
