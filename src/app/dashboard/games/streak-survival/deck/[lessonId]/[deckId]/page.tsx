import { StreakSurvivalMode } from "@/components/games/streak-survival-mode";
import {
  FlashcardAccessDenied,
  FlashcardDeckEmpty,
} from "@/components/flashcards/deck-states";
import { loadFlashcardDeck } from "@/lib/flashcards/load-deck";
import { fetchPersonalBest } from "@/lib/games/game-scores";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

type StreakSurvivalDeckPageProps = {
  params: Promise<{ lessonId: string; deckId: string }>;
};

export default async function StreakSurvivalDeckPage({ params }: StreakSurvivalDeckPageProps) {
  const { lessonId, deckId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const result = await loadFlashcardDeck(supabase, user!.id, lessonId, deckId);

  if (result.kind === "not_found") notFound();
  if (result.kind === "forbidden") {
    return <FlashcardAccessDenied requiredCourseLabel={result.requiredCourseLabel ?? null} />;
  }
  if (result.kind === "empty") return <FlashcardDeckEmpty />;

  const best = await fetchPersonalBest(supabase, user!.id, "streak_survival");

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <StreakSurvivalMode
        sourceType="deck"
        deckName={result.deck.deckName}
        cards={result.deck.cards}
        initialBestScore={best ?? 0}
        backHref="/dashboard/games/streak-survival"
      />
    </div>
  );
}
