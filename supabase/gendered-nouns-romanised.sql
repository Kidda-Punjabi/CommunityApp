-- Add romanised transliteration for gendered nouns (Gender Sort game)
-- Run in Supabase SQL Editor

ALTER TABLE public.gendered_nouns
  ADD COLUMN IF NOT EXISTS romanised TEXT;

COMMENT ON COLUMN public.gendered_nouns.romanised IS
  'Romanised pronunciation shown under the Gurmukhi word in games.';

NOTIFY pgrst, 'reload schema';
