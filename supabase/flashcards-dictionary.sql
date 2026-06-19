-- Romanised pronunciation on master vocabulary flashcards (Dictionary search)
-- Run in Supabase SQL Editor

ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS romanised TEXT;

COMMENT ON COLUMN public.flashcards.romanised IS
  'Romanised pronunciation for Dictionary lookup (e.g. kursi).';

CREATE INDEX IF NOT EXISTS idx_flashcards_romanised
  ON public.flashcards (romanised)
  WHERE romanised IS NOT NULL;

NOTIFY pgrst, 'reload schema';
