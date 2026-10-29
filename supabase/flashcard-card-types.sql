-- Flashcard types (approved 29 Oct 2026): words, sentences, questions, speak-about.
-- Lets Community activities pick the right kind of card for each level:
--   word      : one word / short phrase, flip to see Punjabi            (Beginner)
--   sentence  : full sentence using the week's grammar                 (Beginner to Intermediate)
--   question  : answer out loud, flip shows an example answer          (Intermediate)
--   speak     : "Tell us about…" prompt, 60s talk, helper words on back (Advanced)

ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS card_type TEXT NOT NULL DEFAULT 'word';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'flashcards_card_type_check'
  ) THEN
    ALTER TABLE public.flashcards
      ADD CONSTRAINT flashcards_card_type_check
      CHECK (card_type IN ('word', 'sentence', 'question', 'speak'));
  END IF;
END $$;

COMMENT ON COLUMN public.flashcards.card_type IS
  'word | sentence | question | speak. Drives the study card layout and which Community level gets the card.';

-- First pass classification of existing cards (spot-check in admin afterwards):
-- a front ending in ? is a question; more than three words is a sentence; else a word.
UPDATE public.flashcards
SET card_type = CASE
  WHEN trim(front_text) ~ '[?？]\s*$' THEN 'question'
  WHEN array_length(regexp_split_to_array(trim(front_text), '\s+'), 1) > 3 THEN 'sentence'
  ELSE 'word'
END
WHERE card_type = 'word';

CREATE INDEX IF NOT EXISTS idx_flashcards_lesson_card_type
  ON public.flashcards (lesson_id, card_type);

NOTIFY pgrst, 'reload schema';
