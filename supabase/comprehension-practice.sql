-- =============================================================================
-- Kidda — Comprehension Practice (scripts, sentences, questions + audio bucket)
-- Run in Supabase SQL Editor
-- =============================================================================
-- RLS: mirrors grammar_sentences / conversation_practice — SELECT for authenticated,
-- writes via public.is_admin().
-- Storage: mirrors lesson-pdfs / audio-files — public bucket, world-readable URLs,
-- admin upload via is_admin().

-- -----------------------------------------------------------------------------
-- 1. Tables
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.comprehension_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  difficulty INTEGER CHECK (difficulty IS NULL OR (difficulty >= 1 AND difficulty <= 5)),
  display_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.comprehension_sentences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID NOT NULL REFERENCES public.comprehension_scripts(id) ON DELETE CASCADE,
  sequence_order INTEGER NOT NULL,
  gurmukhi_text TEXT NOT NULL,
  romanised_text TEXT NOT NULL,
  english_translation TEXT,
  audio_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT comprehension_sentences_script_sequence_unique
    UNIQUE (script_id, sequence_order)
);

CREATE INDEX IF NOT EXISTS idx_comprehension_sentences_script
  ON public.comprehension_sentences (script_id, sequence_order);

CREATE TABLE IF NOT EXISTS public.comprehension_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID NOT NULL REFERENCES public.comprehension_scripts(id) ON DELETE CASCADE,
  related_sentence_id UUID REFERENCES public.comprehension_sentences(id) ON DELETE SET NULL,
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option TEXT NOT NULL CHECK (correct_option IN ('a', 'b', 'c', 'd')),
  sequence_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comprehension_questions_script
  ON public.comprehension_questions (script_id, sequence_order);

-- -----------------------------------------------------------------------------
-- 2. RLS
-- -----------------------------------------------------------------------------

ALTER TABLE public.comprehension_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comprehension_sentences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comprehension_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read comprehension_scripts" ON public.comprehension_scripts;
CREATE POLICY "Authenticated read comprehension_scripts"
  ON public.comprehension_scripts FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage comprehension_scripts" ON public.comprehension_scripts;
CREATE POLICY "Admins manage comprehension_scripts"
  ON public.comprehension_scripts FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Authenticated read comprehension_sentences" ON public.comprehension_sentences;
CREATE POLICY "Authenticated read comprehension_sentences"
  ON public.comprehension_sentences FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage comprehension_sentences" ON public.comprehension_sentences;
CREATE POLICY "Admins manage comprehension_sentences"
  ON public.comprehension_sentences FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Authenticated read comprehension_questions" ON public.comprehension_questions;
CREATE POLICY "Authenticated read comprehension_questions"
  ON public.comprehension_questions FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage comprehension_questions" ON public.comprehension_questions;
CREATE POLICY "Admins manage comprehension_questions"
  ON public.comprehension_questions FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT ON public.comprehension_scripts TO authenticated;
GRANT SELECT ON public.comprehension_sentences TO authenticated;
GRANT SELECT ON public.comprehension_questions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.comprehension_scripts TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.comprehension_sentences TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.comprehension_questions TO authenticated;
GRANT ALL ON public.comprehension_scripts TO service_role;
GRANT ALL ON public.comprehension_sentences TO service_role;
GRANT ALL ON public.comprehension_questions TO service_role;

-- -----------------------------------------------------------------------------
-- 3. game_scores — add comprehension_practice
-- -----------------------------------------------------------------------------

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
    'comprehension_practice'
  ]));

-- -----------------------------------------------------------------------------
-- 4. Storage — comprehension-audio (public URLs, lesson-pdfs pattern)
-- -----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('comprehension-audio', 'comprehension-audio', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Anyone can view comprehension audio" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload comprehension audio" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update comprehension audio" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete comprehension audio" ON storage.objects;

CREATE POLICY "Anyone can view comprehension audio"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'comprehension-audio');

CREATE POLICY "Admins can upload comprehension audio"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'comprehension-audio' AND public.is_admin());

CREATE POLICY "Admins can update comprehension audio"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'comprehension-audio' AND public.is_admin())
  WITH CHECK (bucket_id = 'comprehension-audio' AND public.is_admin());

CREATE POLICY "Admins can delete comprehension audio"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'comprehension-audio' AND public.is_admin());

NOTIFY pgrst, 'reload schema';
