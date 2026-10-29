/** What kind of card it is (flashcards.card_type). Drives the study layout. */
export type FlashcardCardType = "word" | "sentence" | "question" | "speak";

export const FLASHCARD_CARD_TYPES: readonly FlashcardCardType[] = ["word", "sentence", "question", "speak"];

export const FLASHCARD_CARD_TYPE_LABELS: Record<FlashcardCardType, string> = {
  word: "Words",
  sentence: "Sentences",
  question: "Questions",
  speak: "Speak about",
};

export function parseFlashcardCardType(value: unknown): FlashcardCardType | null {
  return typeof value === "string" && (FLASHCARD_CARD_TYPES as readonly string[]).includes(value)
    ? (value as FlashcardCardType)
    : null;
}

export type FlashcardDeckCard = {
  id: string;
  front_text: string;
  back_text: string;
  romanised: string | null;
  deck_id: string | null;
  deck_name: string;
  icon_name?: string | null;
  card_type?: FlashcardCardType | null;
  example_sentence_gurmukhi?: string | null;
  example_sentence_romanised?: string | null;
  example_sentence_english?: string | null;
  /** Approved TTS URL when available (Everyday Punjabi Listen). */
  audioUrl?: string | null;
};

export type FlashcardDeckContext = {
  lessonId: string;
  lessonTitle: string;
  courseName: string;
  lessonNumber: number;
  deckId: string | null;
  deckName: string;
  cards: FlashcardDeckCard[];
};
