-- =============================================================================
-- Kidda — Kihda? (Possessive Practice)
-- Run in Supabase SQL Editor
-- =============================================================================
-- RLS: mirrors grammar_sentences / flashcards — SELECT for authenticated,
-- writes via public.is_admin().
--
-- Feminine possessives do NOT change in oblique position (confirmed directly
-- from Kidda's Week 7 course material: "Oblique forms are only used for
-- masculine objects, possessives do not change when used for feminine
-- objects"). fem_sg_gurmukhi/romanised is the correct form to use in BOTH
-- normal and oblique contexts for feminine nouns - this is not an assumption,
-- it's the taught rule. Masculine nouns use masc_sg_gurmukhi/romanised when
-- standing alone, and oblique_gurmukhi/romanised when followed by a
-- postposition.

-- -----------------------------------------------------------------------------
-- 1. Reference tables
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.possessive_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_english TEXT NOT NULL,
  masc_sg_gurmukhi TEXT NOT NULL,
  masc_sg_romanised TEXT NOT NULL,
  fem_sg_gurmukhi TEXT NOT NULL,
  fem_sg_romanised TEXT NOT NULL,
  oblique_gurmukhi TEXT NOT NULL,
  oblique_romanised TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT possessive_forms_person_english_unique UNIQUE (person_english)
);

CREATE TABLE IF NOT EXISTS public.postpositions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gurmukhi TEXT NOT NULL,
  romanised TEXT NOT NULL,
  english TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT postpositions_romanised_unique UNIQUE (romanised)
);

-- -----------------------------------------------------------------------------
-- 2. RLS
-- -----------------------------------------------------------------------------

ALTER TABLE public.possessive_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.postpositions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read possessive_forms" ON public.possessive_forms;
CREATE POLICY "Authenticated read possessive_forms"
  ON public.possessive_forms FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage possessive_forms" ON public.possessive_forms;
CREATE POLICY "Admins manage possessive_forms"
  ON public.possessive_forms FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Authenticated read postpositions" ON public.postpositions;
CREATE POLICY "Authenticated read postpositions"
  ON public.postpositions FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage postpositions" ON public.postpositions;
CREATE POLICY "Admins manage postpositions"
  ON public.postpositions FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT ON public.possessive_forms TO authenticated;
GRANT SELECT ON public.postpositions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.possessive_forms TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.postpositions TO authenticated;
GRANT ALL ON public.possessive_forms TO service_role;
GRANT ALL ON public.postpositions TO service_role;

-- -----------------------------------------------------------------------------
-- 3. game_scores — add possessive_practice
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
    'possessive_practice'
  ]));

-- -----------------------------------------------------------------------------
-- 4. Seed — possessive forms (6 rows)
-- -----------------------------------------------------------------------------

INSERT INTO public.possessive_forms (
  person_english,
  masc_sg_gurmukhi, masc_sg_romanised,
  fem_sg_gurmukhi, fem_sg_romanised,
  oblique_gurmukhi, oblique_romanised,
  display_order
)
SELECT * FROM (VALUES
  ('my',    'ਮੇਰਾ', 'mera',    'ਮੇਰੀ', 'meri',    'ਮੇਰੇ', 'mere',    0),
  ('your',  'ਤੁਹਾਡਾ', 'tuhada',  'ਤੁਹਾਡੀ', 'tuhadi',  'ਤੁਹਾਡੇ', 'tuhade',  1),
  ('his/her', 'ਉਸਦਾ', 'osda',    'ਉਸਦੀ', 'osdi',    'ਉਸਦੇ', 'osde',    2),
  ('their', 'ਉਹਨਾਂ ਦਾ', 'ohna da', 'ਉਹਨਾਂ ਦੀ', 'ohna di', 'ਉਹਨਾਂ ਦੇ', 'ohna de', 3),
  ('own',   'ਆਪਣਾ', 'apna',    'ਆਪਣੀ', 'apni',    'ਆਪਣੇ', 'apne',    4),
  ('our',   'ਸਾਡਾ', 'saada',   'ਸਾਡੀ', 'saadi',   'ਸਾਡੇ', 'saade',   5)
) AS seed(person_english, masc_sg_gurmukhi, masc_sg_romanised, fem_sg_gurmukhi, fem_sg_romanised, oblique_gurmukhi, oblique_romanised, display_order)
WHERE NOT EXISTS (SELECT 1 FROM public.possessive_forms LIMIT 1);

-- -----------------------------------------------------------------------------
-- 5. Seed — postpositions (4 rows)
-- -----------------------------------------------------------------------------

INSERT INTO public.postpositions (gurmukhi, romanised, english)
SELECT * FROM (VALUES
  ('ਵਿੱਚ', 'vich', 'in'),
  ('ਨਾਲ', 'naal', 'with'),
  ('ਤੋਂ', 'ton', 'from'),
  ('ਲਈ', 'lyi', 'for')
) AS seed(gurmukhi, romanised, english)
WHERE NOT EXISTS (SELECT 1 FROM public.postpositions LIMIT 1);

NOTIFY pgrst, 'reload schema';
