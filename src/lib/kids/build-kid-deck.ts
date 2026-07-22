import type { FlashcardDeckContext } from "@/lib/flashcards/types";

type KidFlashcardRow = {
  id: string;
  front_text: string;
  back_text: string;
  icon_name?: string | null;
};

export function buildKidDeckContext(
  cards: KidFlashcardRow[],
  deckName: string
): FlashcardDeckContext {
  return {
    lessonId: "kids",
    lessonTitle: "Kids practice",
    courseName: "Kids",
    lessonNumber: 0,
    deckId: null,
    deckName,
    cards: cards.map((card) => ({
      id: card.id,
      front_text: card.front_text,
      back_text: card.back_text,
      romanised: null,
      deck_id: null,
      deck_name: deckName,
      icon_name: card.icon_name,
    })),
  };
}
