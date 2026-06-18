import { WordScrambleMode } from "@/components/games/word-scramble-mode";
import {
  FlashcardAccessDenied,
  FlashcardDeckEmpty,
} from "@/components/flashcards/deck-states";
import { loadFlashcardDeck } from "@/lib/flashcards/load-deck";
import { fetchPersonalBest } from "@/lib/games/game-scores";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

type WordScramblePlayPageProps = {
  params: Promise<{ lessonId: string; deckId: string }>;
};

export default async function WordScramblePlayPage({ params }: WordScramblePlayPageProps) {
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

  const best = await fetchPersonalBest(
    supabase,
    user!.id,
    "word_scramble",
    { deck_name: result.deck.deckName }
  );

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <WordScrambleMode deck={result.deck} initialBestScore={best ?? 0} />
    </div>
  );
}
