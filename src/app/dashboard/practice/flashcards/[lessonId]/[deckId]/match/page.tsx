import { FlashcardMatchMode } from "@/components/flashcards/match-mode";
import {
  FlashcardAccessDenied,
  FlashcardDeckEmpty,
} from "@/components/flashcards/deck-states";
import { loadFlashcardDeck } from "@/lib/flashcards/load-deck";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

type MatchPageProps = {
  params: Promise<{ lessonId: string; deckId: string }>;
};

export default async function FlashcardsMatchPage({ params }: MatchPageProps) {
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

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <FlashcardMatchMode
        deck={result.deck}
        initialBestScore={result.matchScore?.best_score ?? 0}
      />
    </div>
  );
}
