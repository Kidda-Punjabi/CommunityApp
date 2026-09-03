import { WordStartMode } from "@/components/games/word-start-mode";
import { loadWordStartWords } from "@/lib/games/load-word-start";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function WordStartPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { words, loadError } = await loadWordStartWords(supabase);

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <WordStartMode words={words} loadError={loadError} />
    </div>
  );
}
