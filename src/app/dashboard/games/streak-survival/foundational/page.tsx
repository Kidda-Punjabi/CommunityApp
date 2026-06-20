import Link from "next/link";
import { StreakSurvivalMode } from "@/components/games/streak-survival-mode";
import { loadFoundationalCourseCards } from "@/lib/games/load-foundational-course-cards";
import { fetchPersonalBest } from "@/lib/games/game-scores";
import { createClient } from "@/lib/supabase/server";

export default async function StreakSurvivalFoundationalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { cards, deckCount } = await loadFoundationalCourseCards(supabase, user!);
  const initialBestScore =
    (await fetchPersonalBest(supabase, user!.id, "streak_survival", {
      source: "foundational_course",
    })) ?? 0;

  if (cards.length === 0) {
    return (
      <div className="flex flex-1 flex-col px-4 py-6">
        <Link
          href="/dashboard/games/streak-survival"
          className="text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          ← Back
        </Link>
        <p className="mt-6 text-sm text-zinc-600">
          No Foundational Course flashcards available yet. Unlock the Foundational Course or try a
          lesson deck instead.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <StreakSurvivalMode
        sourceType="deck"
        deckName={`Foundational Course (${deckCount} decks)`}
        cards={cards}
        initialBestScore={initialBestScore}
        backHref="/dashboard/games/streak-survival"
        metadataSource="foundational_course"
      />
    </div>
  );
}
