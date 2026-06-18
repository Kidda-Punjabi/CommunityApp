export type FlashcardDeckCard = {
  id: string;
  front_text: string;
  back_text: string;
  deck_name: string;
};

export type FlashcardDeckContext = {
  lessonId: string;
  lessonTitle: string;
  courseName: string;
  lessonNumber: number;
  deckName: string;
  cards: FlashcardDeckCard[];
};
