import { MemoryGridMode } from "@/components/games/memory-grid-mode";
import {
  FlashcardAccessDenied,
  FlashcardDeckEmpty,
} from "@/components/flashcards/deck-states";
import { loadChallengeForGamePage } from "@/lib/challenges/load-challenge-for-page";
import { loadFlashcardDeck } from "@/lib/flashcards/load-deck";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

type MemoryGridPlayPageProps = {
  params: Promise<{ lessonId: string; deckId: string }>;
  searchParams: Promise<{ challenge?: string; catchupReturn?: string }>;
};

export default async function MemoryGridPlayPage({
  params,
  searchParams,
}: MemoryGridPlayPageProps) {
  const { lessonId, deckId } = await params;
  const { catchupReturn } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [result, challenge] = await Promise.all([
    loadFlashcardDeck(supabase, user!.id, lessonId, deckId),
    loadChallengeForGamePage(searchParams),
  ]);

  if (result.kind === "not_found") notFound();
  if (result.kind === "forbidden") {
    return <FlashcardAccessDenied requiredCourseLabel={result.requiredCourseLabel ?? null} />;
  }
  if (result.kind === "empty") return <FlashcardDeckEmpty />;

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <MemoryGridMode
        deck={result.deck}
        initialBestScore={result.matchScore?.best_score ?? 0}
        challenge={challenge}
        catchupReturn={catchupReturn ?? null}
      />
    </div>
  );
}
