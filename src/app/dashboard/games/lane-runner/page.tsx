import { LaneRunnerMode } from "@/components/games/lane-runner-mode";
import { loadCoinBalance } from "@/lib/coins/balance";
import { loadLaneRunnerFlashcards } from "@/lib/games/lane-runner/load-flashcards";
import { createClient } from "@/lib/supabase/server";

export default async function LaneRunnerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ cards, loadError }, coinBalance, profile] = await Promise.all([
    loadLaneRunnerFlashcards(supabase),
    user ? loadCoinBalance(supabase, user.id) : Promise.resolve(0),
    user
      ? supabase
          .from("profiles")
          .select("learner_level")
          .eq("id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] flex-col px-4 py-6">
      <LaneRunnerMode
        cards={cards}
        loadError={loadError}
        initialCoinBalance={coinBalance}
        learnerLevel={profile.data?.learner_level ?? null}
      />
    </div>
  );
}
