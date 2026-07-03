import { ChadoPauriMode } from "@/components/games/chado-pauri-mode";
import { fetchPersonalBest } from "@/lib/games/game-scores";
import { loadChadoPauriFlashcards } from "@/lib/games/chado-pauri/load-flashcards";
import { createClient } from "@/lib/supabase/server";

export default async function ChadoPauriPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ cards, loadError }, best] = await Promise.all([
    loadChadoPauriFlashcards(supabase),
    user ? fetchPersonalBest(supabase, user.id, "chado_pauri") : Promise.resolve(null),
  ]);

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <ChadoPauriMode cards={cards} loadError={loadError} initialBestScore={best ?? 0} />
    </div>
  );
}
