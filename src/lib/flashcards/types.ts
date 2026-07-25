export type FlashcardDeckCard = {
  id: string;
  front_text: string;
  back_text: string;
  romanised: string | null;
  deck_id: string | null;
  deck_name: string;
  icon_name?: string | null;
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
