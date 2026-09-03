-- =============================================================================
-- Kidda — Vowel Match (solo vocab game)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.vowel_game_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word_gurmukhi TEXT NOT NULL,
  meaning_english TEXT NOT NULL,
  romanised TEXT NOT NULL,
  vowels_tested TEXT[] NOT NULL,
  audio_pa_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT vowel_game_words_word_gurmukhi_unique UNIQUE (word_gurmukhi)
);

ALTER TABLE public.vowel_game_words ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read vowel_game_words" ON public.vowel_game_words;
CREATE POLICY "Authenticated read vowel_game_words"
  ON public.vowel_game_words FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage vowel_game_words" ON public.vowel_game_words;
CREATE POLICY "Admins manage vowel_game_words"
  ON public.vowel_game_words FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT ON public.vowel_game_words TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.vowel_game_words TO authenticated;
GRANT ALL ON public.vowel_game_words TO service_role;

INSERT INTO public.vowel_game_words (
  word_gurmukhi,
  meaning_english,
  romanised,
  vowels_tested,
  display_order
)
VALUES
  ('ਘਰ', 'house', 'ghar', ARRAY['mukta'], 1),
  ('ਬਾਰੀ', 'window', 'baari', ARRAY['kanna', 'bihari'], 2),
  ('ਕਿਤਾਬ', 'book', 'kitaab', ARRAY['sihari', 'kanna'], 3),
  ('ਰੋਟੀ', 'flatbread', 'roti', ARRAY['hora', 'bihari'], 4),
  ('ਦੁੱਧ', 'milk', 'dudh', ARRAY['aunkar'], 5),
  ('ਸੂਰਜ', 'sun', 'sooraj', ARRAY['dulainkar'], 6),
  ('ਮੇਜ', 'table', 'mej', ARRAY['lavan'], 7),
  ('ਪੈਰ', 'foot', 'pair', ARRAY['dulavan'], 8),
  ('ਦੋ', 'two', 'do', ARRAY['hora'], 9),
  ('ਤੌਲੀਆ', 'towel', 'toliaa', ARRAY['kanaura', 'bihari'], 10)
ON CONFLICT (word_gurmukhi) DO UPDATE SET
  meaning_english = EXCLUDED.meaning_english,
  romanised = EXCLUDED.romanised,
  vowels_tested = EXCLUDED.vowels_tested,
  display_order = EXCLUDED.display_order;

ALTER TABLE public.game_scores DROP CONSTRAINT IF EXISTS game_scores_game_type_check;

ALTER TABLE public.game_scores ADD CONSTRAINT game_scores_game_type_check
  CHECK (game_type = ANY (ARRAY[
    'match',
    'memory_grid',
    'speed_translate',
    'word_scramble',
    'streak_survival',
    'sentence_builder',
    'conjugation_challenge',
    'gender_sort',
    'picture_match',
    'voice_practice',
    'chado_pauri',
    'conversation_practice',
    'possessive_practice',
    'spot_the_mistake',
    'comprehension_practice',
    'lane_runner',
    'speaking_practice',
    'vowel_match'
  ]));

NOTIFY pgrst, 'reload schema';
