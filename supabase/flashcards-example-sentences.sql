-- =============================================================================
-- Kidda — Example sentences on dictionary vocabulary flashcards
-- Run in Supabase SQL Editor
-- =============================================================================

ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS example_sentence_gurmukhi TEXT,
  ADD COLUMN IF NOT EXISTS example_sentence_romanised TEXT,
  ADD COLUMN IF NOT EXISTS example_sentence_english TEXT;

COMMENT ON COLUMN public.flashcards.example_sentence_gurmukhi IS
  'Dictionary example sentence in Gurmukhi — TTS script for flashcard_example audio.';
COMMENT ON COLUMN public.flashcards.example_sentence_romanised IS
  'Romanised example sentence for Dictionary display.';
COMMENT ON COLUMN public.flashcards.example_sentence_english IS
  'English translation of the example sentence for Dictionary display.';

NOTIFY pgrst, 'reload schema';
