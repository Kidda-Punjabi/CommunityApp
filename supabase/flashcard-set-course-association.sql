-- =============================================================================
-- Kidda — Flashcard set course grouping (admin organisation)
-- Run once in Supabase SQL Editor (after flashcard-sets.sql)
-- =============================================================================

ALTER TABLE public.flashcard_sets
  ADD COLUMN IF NOT EXISTS course_association TEXT NOT NULL DEFAULT 'uncategorized',
  ADD COLUMN IF NOT EXISTS week_number INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'flashcard_sets_course_association_check'
      AND conrelid = 'public.flashcard_sets'::regclass
  ) THEN
    ALTER TABLE public.flashcard_sets
      ADD CONSTRAINT flashcard_sets_course_association_check
      CHECK (
        course_association IN ('foundations', 'beginners', 'community', 'uncategorized')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'flashcard_sets_week_number_check'
      AND conrelid = 'public.flashcard_sets'::regclass
  ) THEN
    ALTER TABLE public.flashcard_sets
      ADD CONSTRAINT flashcard_sets_week_number_check
      CHECK (week_number IS NULL OR week_number BETWEEN 1 AND 12);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_flashcard_sets_course_association
  ON public.flashcard_sets (course_association);

CREATE INDEX IF NOT EXISTS idx_flashcard_sets_week_number
  ON public.flashcard_sets (week_number)
  WHERE week_number IS NOT NULL;

COMMENT ON COLUMN public.flashcard_sets.course_association IS
  'Admin grouping: foundations | beginners | community | uncategorized.';
COMMENT ON COLUMN public.flashcard_sets.week_number IS
  'Beginners 12-week program week (1–12). Null for non-beginners sets.';

-- -----------------------------------------------------------------------------
-- One-time backfill by name pattern (do not re-run after manual admin corrections)
-- -----------------------------------------------------------------------------

-- Foundations course
UPDATE public.flashcard_sets
SET course_association = 'foundations',
    week_number = NULL
WHERE name ILIKE 'Foundations%';

-- Beginners: "Week N - ..."
UPDATE public.flashcard_sets AS s
SET course_association = 'beginners',
    week_number = m.week_num
FROM (
  SELECT id, (regexp_match(name, '^Week (\d+)'))[1]::INTEGER AS week_num
  FROM public.flashcard_sets
  WHERE name ~ '^Week [0-9]+'
) AS m
WHERE s.id = m.id
  AND m.week_num BETWEEN 1 AND 12;

-- Beginners: "Vocabulary - Week N"
UPDATE public.flashcard_sets AS s
SET course_association = 'beginners',
    week_number = m.week_num
FROM (
  SELECT id, (regexp_match(name, '^Vocabulary - Week (\d+)'))[1]::INTEGER AS week_num
  FROM public.flashcard_sets
  WHERE name ~ '^Vocabulary - Week [0-9]+'
) AS m
WHERE s.id = m.id
  AND m.week_num BETWEEN 1 AND 12;

-- Community: thematic vocabulary decks (not week-specific)
UPDATE public.flashcard_sets
SET course_association = 'community',
    week_number = NULL
WHERE name ~ '^Vocabulary - (Animals|Body|Colours|Descriptive|Family|Food|Furniture|Master List|Nature|Shapes|Time)$';

-- Remaining rows (e.g. FC - Set 1–4) stay uncategorized for manual review

NOTIFY pgrst, 'reload schema';
