-- =============================================================================
-- Kidda — Flashcard set ↔ course / lesson links (one-time backfill)
-- Run in Supabase SQL Editor after flashcard-set-course-association.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Fill week_number gaps on flashcard_sets
-- -----------------------------------------------------------------------------

UPDATE public.flashcard_sets
SET week_number = 1
WHERE course_association = 'foundations'
  AND week_number IS NULL
  AND name ~* '^FC\s*-?\s*Set\s*1';

UPDATE public.flashcard_sets
SET week_number = 2
WHERE course_association = 'foundations'
  AND week_number IS NULL
  AND name ~* '^FC\s*-?\s*Set\s*2';

UPDATE public.flashcard_sets
SET week_number = 3
WHERE course_association = 'foundations'
  AND week_number IS NULL
  AND name ~* '^FC\s*-?\s*Set\s*3';

UPDATE public.flashcard_sets
SET week_number = 4
WHERE course_association = 'foundations'
  AND week_number IS NULL
  AND name ~* '^FC\s*-?\s*Set\s*4';

UPDATE public.flashcard_sets AS s
SET week_number = m.week_num
FROM (
  SELECT id, (regexp_match(name, '^Foundations L(\d+)', 'i'))[1]::INTEGER AS week_num
  FROM public.flashcard_sets
  WHERE name ~* '^Foundations L[0-9]+'
) AS m
WHERE s.id = m.id
  AND s.course_association = 'foundations'
  AND s.week_number IS NULL
  AND m.week_num BETWEEN 1 AND 4;

UPDATE public.flashcard_sets AS s
SET course_association = 'community',
    week_number = m.week_num
FROM (
  SELECT id, (regexp_match(name, '^Week (\d+)'))[1]::INTEGER AS week_num
  FROM public.flashcard_sets
  WHERE name ~ '^Week [0-9]+'
    AND name ~* '\(Community\)'
) AS m
WHERE s.id = m.id
  AND m.week_num BETWEEN 1 AND 24;

UPDATE public.flashcard_sets AS s
SET week_number = m.week_num
FROM (
  SELECT id, (regexp_match(name, '^Week (\d+)'))[1]::INTEGER AS week_num
  FROM public.flashcard_sets
  WHERE name ~ '^Week [0-9]+'
    AND name ~* '\(Community\)'
) AS m
WHERE s.id = m.id
  AND s.course_association = 'community'
  AND s.week_number IS NULL
  AND m.week_num BETWEEN 1 AND 24;

-- Week 7 community set without "(Community)" suffix
UPDATE public.flashcard_sets
SET course_association = 'community',
    week_number = 7
WHERE name = 'Week 7 - Things You Can Do and Connectors'
  AND course_association IS DISTINCT FROM 'community';

-- Allow weeks 13–24 for Community course sets
ALTER TABLE public.flashcard_sets
  DROP CONSTRAINT IF EXISTS flashcard_sets_week_number_check;

ALTER TABLE public.flashcard_sets
  ADD CONSTRAINT flashcard_sets_week_number_check
  CHECK (week_number IS NULL OR week_number BETWEEN 1 AND 24);


DELETE FROM public.set_course_links;

WITH
  tier_courses AS (
    SELECT required_tier, id AS course_id
    FROM public.courses
    WHERE required_tier IN ('foundational', 'beginners', 'community')
  ),
  resolved AS (
    SELECT
      fs.id AS deck_id,
      tc.course_id,
      l.id AS lesson_id
    FROM public.flashcard_sets AS fs
    JOIN tier_courses AS tc ON (
      (fs.course_association = 'foundations' AND tc.required_tier = 'foundational')
      OR (fs.course_association = 'beginners' AND tc.required_tier = 'beginners')
      OR (fs.course_association = 'community' AND tc.required_tier = 'community')
    )
    LEFT JOIN public.lessons AS l ON (
      l.course_id = tc.course_id
      AND l.lesson_number = fs.week_number
      AND fs.week_number IS NOT NULL
    )
    WHERE fs.course_association IN ('foundations', 'beginners', 'community')
  ),
  course_rows AS (
    SELECT DISTINCT deck_id, course_id, NULL::UUID AS lesson_id
    FROM resolved
  ),
  lesson_rows AS (
    SELECT deck_id, course_id, lesson_id
    FROM resolved
    WHERE lesson_id IS NOT NULL
  )
INSERT INTO public.set_course_links (deck_id, course_id, lesson_id)
SELECT deck_id, course_id, lesson_id FROM course_rows
UNION ALL
SELECT deck_id, course_id, lesson_id FROM lesson_rows;

NOTIFY pgrst, 'reload schema';
