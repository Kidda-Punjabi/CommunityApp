import { LaneRunnerMode } from "@/components/games/lane-runner-mode";
import { loadLaneRunnerFlashcards } from "@/lib/games/lane-runner/load-flashcards";
import { createClient } from "@/lib/supabase/server";

export default async function LaneRunnerPage() {
  const supabase = await createClient();

  const { cards, loadError } = await loadLaneRunnerFlashcards(supabase);

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] flex-col px-4 py-6">
      <LaneRunnerMode cards={cards} loadError={loadError} />
    </div>
  );
}
