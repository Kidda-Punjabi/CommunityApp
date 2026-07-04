import { BackLink } from "@/components/navigation/back-link";
import Link from "next/link";
import { StreakSurvivalMode } from "@/components/games/streak-survival-mode";
import { loadChallengeForGamePage } from "@/lib/challenges/load-challenge-for-page";
import { loadFoundationalCourseCards } from "@/lib/games/load-foundational-course-cards";
import { fetchPersonalBest } from "@/lib/games/game-scores";
import { createClient } from "@/lib/supabase/server";

type StreakSurvivalFoundationalPageProps = {
  searchParams: Promise<{ challenge?: string }>;
};

export default async function StreakSurvivalFoundationalPage({
  searchParams,
}: StreakSurvivalFoundationalPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ cards, deckCount }, challenge, initialBestScore] = await Promise.all([
    loadFoundationalCourseCards(supabase, user!),
    loadChallengeForGamePage(searchParams),
    fetchPersonalBest(supabase, user!.id, "streak_survival", {
      source: "foundational_course",
    }),
  ]);

  if (cards.length === 0) {
    return (
      <div className="flex flex-1 flex-col px-4 py-6">
        <BackLink fallbackHref="/dashboard/games/streak-survival" className="text-sm font-medium text-violet-600 hover:text-violet-500">← Back</BackLink>
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
        initialBestScore={initialBestScore ?? 0}
        backHref="/dashboard/games/streak-survival"
        metadataSource="foundational_course"
        challenge={challenge}
      />
    </div>
  );
}
