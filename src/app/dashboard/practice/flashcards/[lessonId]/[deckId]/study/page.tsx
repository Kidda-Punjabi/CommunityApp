import { FlashcardStudyMode } from "@/components/flashcards/study-mode";
import {
  FlashcardAccessDenied,
  FlashcardDeckEmpty,
} from "@/components/flashcards/deck-states";
import { loadFlashcardDeck } from "@/lib/flashcards/load-deck";
import { parseFlashcardCardType } from "@/lib/flashcards/types";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

type StudyPageProps = {
  params: Promise<{ lessonId: string; deckId: string }>;
  searchParams: Promise<{ catchupReturn?: string; type?: string }>;
};

export default async function FlashcardsStudyPage({ params, searchParams }: StudyPageProps) {
  const { lessonId, deckId } = await params;
  const { catchupReturn, type } = await searchParams;
  const cardType = parseFlashcardCardType(type);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const result = await loadFlashcardDeck(supabase, user!.id, lessonId, deckId, {
    includeSpeak: cardType === "speak",
  });

  if (result.kind === "not_found") notFound();
  if (result.kind === "forbidden") {
    return <FlashcardAccessDenied requiredCourseLabel={result.requiredCourseLabel ?? null} />;
  }
  if (result.kind === "empty") return <FlashcardDeckEmpty />;

  // ?type=question etc. (set by Community activities) narrows the deck to one card type.
  // If the deck has none of that type, show the whole deck rather than an empty screen.
  const typedCards = cardType
    ? result.deck.cards.filter((card) => (card.card_type ?? "word") === cardType)
    : [];
  const deck = typedCards.length > 0 ? { ...result.deck, cards: typedCards } : result.deck;

  return (
    <div className="flex flex-1 flex-col bg-[#F4F1FB] px-4 py-6">
      <FlashcardStudyMode
        deck={deck}
        initialProgress={result.progress}
        catchupReturn={catchupReturn ?? null}
      />
    </div>
  );
}
