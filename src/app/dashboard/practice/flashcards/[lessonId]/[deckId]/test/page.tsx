import { FlashcardTestMode } from "@/components/flashcards/test-mode";
import {
  FlashcardAccessDenied,
  FlashcardDeckEmpty,
} from "@/components/flashcards/deck-states";
import { loadFlashcardDeck } from "@/lib/flashcards/load-deck";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

type TestPageProps = {
  params: Promise<{ lessonId: string; deckId: string }>;
};

export default async function FlashcardsTestPage({ params }: TestPageProps) {
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
      <FlashcardTestMode deck={result.deck} />
    </div>
  );
}
