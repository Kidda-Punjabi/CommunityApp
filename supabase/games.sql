-- =============================================================================
-- Kidda — Games content, unified scores, user game stats
-- Run in Supabase SQL Editor
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Grammar content tables
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.grammar_sentences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  punjabi_sentence TEXT NOT NULL,
  english_translation TEXT NOT NULL,
  word_tiles TEXT[] NOT NULL DEFAULT '{}',
  difficulty INTEGER NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  topic_tags TEXT[] NOT NULL DEFAULT '{}',
  course_id UUID REFERENCES public.courses (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT grammar_sentences_punjabi_not_blank CHECK (btrim(punjabi_sentence) <> ''),
  CONSTRAINT grammar_sentences_english_not_blank CHECK (btrim(english_translation) <> '')
);

CREATE INDEX IF NOT EXISTS idx_grammar_sentences_difficulty
  ON public.grammar_sentences (difficulty);
CREATE INDEX IF NOT EXISTS idx_grammar_sentences_course_id
  ON public.grammar_sentences (course_id)
  WHERE course_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.verb_conjugations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verb_root TEXT NOT NULL,
  verb_meaning TEXT NOT NULL,
  conjugations JSONB NOT NULL DEFAULT '{}',
  difficulty INTEGER NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  course_id UUID REFERENCES public.courses (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT verb_conjugations_root_not_blank CHECK (btrim(verb_root) <> ''),
  CONSTRAINT verb_conjugations_meaning_not_blank CHECK (btrim(verb_meaning) <> '')
);

CREATE INDEX IF NOT EXISTS idx_verb_conjugations_difficulty
  ON public.verb_conjugations (difficulty);
CREATE INDEX IF NOT EXISTS idx_verb_conjugations_course_id
  ON public.verb_conjugations (course_id)
  WHERE course_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.gendered_nouns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  punjabi_word TEXT NOT NULL,
  english_meaning TEXT NOT NULL,
  romanised TEXT,
  gender TEXT NOT NULL CHECK (gender IN ('masculine', 'feminine')),
  difficulty INTEGER NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  topic_tags TEXT[] NOT NULL DEFAULT '{}',
  course_id UUID REFERENCES public.courses (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT gendered_nouns_word_not_blank CHECK (btrim(punjabi_word) <> ''),
  CONSTRAINT gendered_nouns_meaning_not_blank CHECK (btrim(english_meaning) <> '')
);

CREATE INDEX IF NOT EXISTS idx_gendered_nouns_difficulty
  ON public.gendered_nouns (difficulty);
CREATE INDEX IF NOT EXISTS idx_gendered_nouns_course_id
  ON public.gendered_nouns (course_id)
  WHERE course_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Unified game scores (replaces match_scores / memory_scores)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.game_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  game_type TEXT NOT NULL CHECK (
    game_type IN (
      'match',
      'memory_grid',
      'speed_translate',
      'word_scramble',
      'streak_survival',
      'sentence_builder',
      'conjugation_challenge',
      'gender_sort'
    )
  ),
  score INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_scores_user_id ON public.game_scores (user_id);
CREATE INDEX IF NOT EXISTS idx_game_scores_user_game ON public.game_scores (user_id, game_type);
CREATE INDEX IF NOT EXISTS idx_game_scores_achieved_at ON public.game_scores (achieved_at DESC);

-- Migrate existing match_scores into game_scores
INSERT INTO public.game_scores (user_id, game_type, score, metadata, achieved_at)
SELECT
  ms.user_id,
  'match',
  ms.best_score,
  jsonb_build_object(
    'deck_name', ms.deck_name,
    'time_seconds', ms.best_time_seconds
  ),
  ms.achieved_at
FROM public.match_scores AS ms
WHERE NOT EXISTS (
  SELECT 1
  FROM public.game_scores AS gs
  WHERE gs.user_id = ms.user_id
    AND gs.game_type = 'match'
    AND gs.metadata ->> 'deck_name' = ms.deck_name
);

-- -----------------------------------------------------------------------------
-- User game stats
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_game_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  total_games_played INTEGER NOT NULL DEFAULT 0,
  favourite_game TEXT,
  highest_streak_survival_score INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- RLS — public read, admin write (grammar content)
-- -----------------------------------------------------------------------------

ALTER TABLE public.grammar_sentences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verb_conjugations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gendered_nouns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_game_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read grammar_sentences" ON public.grammar_sentences;
CREATE POLICY "Public read grammar_sentences"
  ON public.grammar_sentences FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Admins can insert grammar_sentences" ON public.grammar_sentences;
CREATE POLICY "Admins can insert grammar_sentences"
  ON public.grammar_sentences FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update grammar_sentences" ON public.grammar_sentences;
CREATE POLICY "Admins can update grammar_sentences"
  ON public.grammar_sentences FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete grammar_sentences" ON public.grammar_sentences;
CREATE POLICY "Admins can delete grammar_sentences"
  ON public.grammar_sentences FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Public read verb_conjugations" ON public.verb_conjugations;
CREATE POLICY "Public read verb_conjugations"
  ON public.verb_conjugations FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Admins can insert verb_conjugations" ON public.verb_conjugations;
CREATE POLICY "Admins can insert verb_conjugations"
  ON public.verb_conjugations FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update verb_conjugations" ON public.verb_conjugations;
CREATE POLICY "Admins can update verb_conjugations"
  ON public.verb_conjugations FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete verb_conjugations" ON public.verb_conjugations;
CREATE POLICY "Admins can delete verb_conjugations"
  ON public.verb_conjugations FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Public read gendered_nouns" ON public.gendered_nouns;
CREATE POLICY "Public read gendered_nouns"
  ON public.gendered_nouns FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Admins can insert gendered_nouns" ON public.gendered_nouns;
CREATE POLICY "Admins can insert gendered_nouns"
  ON public.gendered_nouns FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update gendered_nouns" ON public.gendered_nouns;
CREATE POLICY "Admins can update gendered_nouns"
  ON public.gendered_nouns FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete gendered_nouns" ON public.gendered_nouns;
CREATE POLICY "Admins can delete gendered_nouns"
  ON public.gendered_nouns FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Users manage own game scores" ON public.game_scores;
CREATE POLICY "Users manage own game scores"
  ON public.game_scores FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own game stats" ON public.user_game_stats;
CREATE POLICY "Users manage own game stats"
  ON public.user_game_stats FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT ON public.grammar_sentences TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.grammar_sentences TO authenticated;
GRANT ALL ON public.grammar_sentences TO service_role;

GRANT SELECT ON public.verb_conjugations TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.verb_conjugations TO authenticated;
GRANT ALL ON public.verb_conjugations TO service_role;

GRANT SELECT ON public.gendered_nouns TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.gendered_nouns TO authenticated;
GRANT ALL ON public.gendered_nouns TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_scores TO authenticated;
GRANT ALL ON public.game_scores TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_game_stats TO authenticated;
GRANT ALL ON public.user_game_stats TO service_role;

NOTIFY pgrst, 'reload schema';
