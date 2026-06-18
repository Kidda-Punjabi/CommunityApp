-- =============================================================================
-- Kidda — Master flashcard database (category, difficulty, topics, dynamic rules)
-- Run the ENTIRE file in Supabase SQL Editor
--
-- Stage: data model only — existing deck_name / lesson_id flows are unchanged.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Extend flashcards into a queryable master table
-- -----------------------------------------------------------------------------
ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS difficulty INTEGER,
  ADD COLUMN IF NOT EXISTS topic_tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS icon_name TEXT;

-- Category: alphabet | vocab | sentences
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'flashcards_category_check'
      AND conrelid = 'public.flashcards'::regclass
  ) THEN
    ALTER TABLE public.flashcards
      ADD CONSTRAINT flashcards_category_check
      CHECK (
        category IS NULL
        OR category IN ('alphabet', 'vocab', 'sentences')
      );
  END IF;
END $$;

-- Difficulty: 1 (easiest) – 5 (hardest)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'flashcards_difficulty_check'
      AND conrelid = 'public.flashcards'::regclass
  ) THEN
    ALTER TABLE public.flashcards
      ADD CONSTRAINT flashcards_difficulty_check
      CHECK (
        difficulty IS NULL
        OR difficulty BETWEEN 1 AND 5
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_flashcards_category
  ON public.flashcards (category);

CREATE INDEX IF NOT EXISTS idx_flashcards_difficulty
  ON public.flashcards (difficulty);

CREATE INDEX IF NOT EXISTS idx_flashcards_topic_tags
  ON public.flashcards USING GIN (topic_tags);

CREATE INDEX IF NOT EXISTS idx_flashcards_category_difficulty
  ON public.flashcards (category, difficulty);

COMMENT ON COLUMN public.flashcards.category IS
  'Card type: alphabet, vocab, or sentences. Nullable for legacy deck-linked rows.';
COMMENT ON COLUMN public.flashcards.difficulty IS
  'Difficulty 1–5. Nullable for legacy rows until backfilled.';
COMMENT ON COLUMN public.flashcards.topic_tags IS
  'Free-form topic labels, e.g. {food,greetings}. Used for dynamic filtering.';
COMMENT ON COLUMN public.flashcards.icon_name IS
  'Optional Lucide icon name for Picture Match and similar modes.';
COMMENT ON COLUMN public.flashcards.deck_name IS
  'Legacy deck grouping — kept for existing lesson decks and match scores.';

-- -----------------------------------------------------------------------------
-- 2. custom_sets — saved user filter combinations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.custom_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filter_criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT custom_sets_name_not_blank CHECK (btrim(name) <> '')
);

CREATE INDEX IF NOT EXISTS idx_custom_sets_user_id
  ON public.custom_sets (user_id);

CREATE INDEX IF NOT EXISTS idx_custom_sets_created_at
  ON public.custom_sets (user_id, created_at DESC);

COMMENT ON TABLE public.custom_sets IS
  'User-saved flashcard filter presets for custom practice.';
COMMENT ON COLUMN public.custom_sets.filter_criteria IS
  'JSON filter snapshot, e.g. {"category":"vocab","difficulty_min":1,"difficulty_max":3,"topic_tags":["food"]}';

-- -----------------------------------------------------------------------------
-- 3. lesson_flashcard_rules — dynamic card pulls per lesson or quiz
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lesson_flashcard_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES public.lessons (id) ON DELETE CASCADE,
  quiz_id UUID REFERENCES public.quizzes (id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  difficulty_min INTEGER NOT NULL DEFAULT 1,
  difficulty_max INTEGER NOT NULL DEFAULT 5,
  topic_tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lesson_flashcard_rules_target_check CHECK (
    (lesson_id IS NOT NULL AND quiz_id IS NULL)
    OR (lesson_id IS NULL AND quiz_id IS NOT NULL)
  ),
  CONSTRAINT lesson_flashcard_rules_category_check CHECK (
    category IN ('alphabet', 'vocab', 'sentences')
  ),
  CONSTRAINT lesson_flashcard_rules_difficulty_range_check CHECK (
    difficulty_min BETWEEN 1 AND 5
    AND difficulty_max BETWEEN 1 AND 5
    AND difficulty_min <= difficulty_max
  )
);

CREATE INDEX IF NOT EXISTS idx_lesson_flashcard_rules_lesson_id
  ON public.lesson_flashcard_rules (lesson_id)
  WHERE lesson_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lesson_flashcard_rules_quiz_id
  ON public.lesson_flashcard_rules (quiz_id)
  WHERE quiz_id IS NOT NULL;

COMMENT ON TABLE public.lesson_flashcard_rules IS
  'Defines which master flashcards a lesson or quiz pulls dynamically.';
COMMENT ON COLUMN public.lesson_flashcard_rules.topic_tags IS
  'When set, only cards sharing at least one tag qualify. NULL = any tag.';

-- -----------------------------------------------------------------------------
-- 4. get_flashcards_by_criteria — shared filter logic
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_flashcards_by_criteria(
  p_category TEXT,
  p_difficulty_min INTEGER,
  p_difficulty_max INTEGER,
  p_topic_tags TEXT[]
)
RETURNS SETOF public.flashcards
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT f.*
  FROM public.flashcards AS f
  WHERE
    -- Category (NULL p_category = no category filter)
    (p_category IS NULL OR f.category = p_category)
    -- Difficulty band (NULL difficulty on a card never matches a filtered pull)
    AND f.difficulty IS NOT NULL
    AND f.difficulty >= p_difficulty_min
    AND f.difficulty <= p_difficulty_max
    -- Topic tags (NULL or empty p_topic_tags = no tag filter)
    AND (
      p_topic_tags IS NULL
      OR cardinality(p_topic_tags) = 0
      OR (
        f.topic_tags IS NOT NULL
        AND cardinality(f.topic_tags) > 0
        AND f.topic_tags && p_topic_tags
      )
    )
  ORDER BY f.category, f.difficulty, f.deck_name, f.created_at;
$$;

COMMENT ON FUNCTION public.get_flashcards_by_criteria(TEXT, INTEGER, INTEGER, TEXT[]) IS
  'Returns master flashcards matching category, difficulty range, and optional topic overlap.';

GRANT EXECUTE ON FUNCTION public.get_flashcards_by_criteria(TEXT, INTEGER, INTEGER, TEXT[])
  TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. Row Level Security
-- -----------------------------------------------------------------------------

-- custom_sets: each user manages their own saved sets
ALTER TABLE public.custom_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own custom sets" ON public.custom_sets;
CREATE POLICY "Users manage own custom sets"
  ON public.custom_sets FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- lesson_flashcard_rules: public read, admin write (same pattern as lessons/quizzes)
ALTER TABLE public.lesson_flashcard_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read lesson_flashcard_rules" ON public.lesson_flashcard_rules;
CREATE POLICY "Public read lesson_flashcard_rules"
  ON public.lesson_flashcard_rules FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can insert lesson_flashcard_rules" ON public.lesson_flashcard_rules;
CREATE POLICY "Admins can insert lesson_flashcard_rules"
  ON public.lesson_flashcard_rules FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update lesson_flashcard_rules" ON public.lesson_flashcard_rules;
CREATE POLICY "Admins can update lesson_flashcard_rules"
  ON public.lesson_flashcard_rules FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete lesson_flashcard_rules" ON public.lesson_flashcard_rules;
CREATE POLICY "Admins can delete lesson_flashcard_rules"
  ON public.lesson_flashcard_rules FOR DELETE TO authenticated
  USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- 6. Grants
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_sets TO authenticated;
GRANT ALL ON public.custom_sets TO service_role;

GRANT SELECT ON public.lesson_flashcard_rules TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.lesson_flashcard_rules TO authenticated;
GRANT ALL ON public.lesson_flashcard_rules TO service_role;

NOTIFY pgrst, 'reload schema';

-- -----------------------------------------------------------------------------
-- Optional backfill (run manually after tagging cards in admin)
-- -----------------------------------------------------------------------------
-- UPDATE public.flashcards
-- SET
--   category = 'vocab',
--   difficulty = 2,
--   topic_tags = ARRAY['greetings']
-- WHERE deck_name = 'Lesson 1 vocab'
--   AND category IS NULL;
