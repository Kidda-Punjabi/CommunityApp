-- =============================================================================
-- Kidda — Deduplicate courses + enforce one row per tier
-- Run in Supabase SQL Editor AFTER duplicates appear in admin dropdown.
-- Safe to re-run once duplicates are gone.
-- =============================================================================

-- Effective tier from required_tier + name (handles mis-tagged rows)
CREATE OR REPLACE FUNCTION public.course_effective_tier(
  p_name TEXT,
  p_required_tier TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_required_tier = 'community' OR p_name ILIKE '%community%' THEN 'community'
    WHEN p_required_tier = 'beginners' OR p_name ILIKE '%beginner%' THEN 'beginners'
    WHEN p_required_tier = 'foundational' OR p_name ILIKE '%foundational%' THEN 'foundational'
    ELSE p_required_tier
  END;
$$;

-- Pick one canonical course per tier (most lessons, then lowest display_order, then oldest id)
WITH ranked AS (
  SELECT
    c.id,
    public.course_effective_tier(c.name, c.required_tier) AS effective_tier,
  ROW_NUMBER() OVER (
    PARTITION BY public.course_effective_tier(c.name, c.required_tier)
    ORDER BY
      (SELECT COUNT(*) FROM public.lessons l WHERE l.course_id = c.id) DESC,
      c.display_order NULLS LAST,
      c.id ASC
  ) AS rn
  FROM public.courses AS c
  WHERE public.course_effective_tier(c.name, c.required_tier)
    IN ('foundational', 'beginners', 'community')
),
canonical AS (
  SELECT id, effective_tier
  FROM ranked
  WHERE rn = 1
),
dupes AS (
  SELECT
    c.id AS dupe_id,
    can.id AS keep_id
  FROM public.courses AS c
  JOIN canonical AS can
    ON can.effective_tier = public.course_effective_tier(c.name, c.required_tier)
  WHERE c.id <> can.id
    AND public.course_effective_tier(c.name, c.required_tier)
      IN ('foundational', 'beginners', 'community')
)
UPDATE public.lessons AS l
SET course_id = d.keep_id
FROM dupes AS d
WHERE l.course_id = d.dupe_id;

WITH ranked AS (
  SELECT
    c.id,
    public.course_effective_tier(c.name, c.required_tier) AS effective_tier,
    ROW_NUMBER() OVER (
      PARTITION BY public.course_effective_tier(c.name, c.required_tier)
      ORDER BY
        (SELECT COUNT(*) FROM public.quizzes q WHERE q.course_id = c.id) DESC,
        c.display_order NULLS LAST,
        c.id ASC
    ) AS rn
  FROM public.courses AS c
  WHERE public.course_effective_tier(c.name, c.required_tier)
    IN ('foundational', 'beginners', 'community')
),
canonical AS (
  SELECT id, effective_tier FROM ranked WHERE rn = 1
),
dupes AS (
  SELECT c.id AS dupe_id, can.id AS keep_id
  FROM public.courses AS c
  JOIN canonical AS can
    ON can.effective_tier = public.course_effective_tier(c.name, c.required_tier)
  WHERE c.id <> can.id
)
UPDATE public.quizzes AS q
SET course_id = d.keep_id
FROM dupes AS d
WHERE q.course_id = d.dupe_id;

-- course_access (if you run course-access.sql later) cascades when duplicate courses are deleted below.

WITH ranked AS (
  SELECT
    c.id,
    public.course_effective_tier(c.name, c.required_tier) AS effective_tier,
    ROW_NUMBER() OVER (
      PARTITION BY public.course_effective_tier(c.name, c.required_tier)
      ORDER BY
        (SELECT COUNT(*) FROM public.lessons l WHERE l.course_id = c.id) DESC,
        c.display_order NULLS LAST,
        c.id ASC
    ) AS rn
  FROM public.courses AS c
  WHERE public.course_effective_tier(c.name, c.required_tier)
    IN ('foundational', 'beginners', 'community')
),
canonical AS (
  SELECT id, effective_tier FROM ranked WHERE rn = 1
)
DELETE FROM public.courses AS c
WHERE public.course_effective_tier(c.name, c.required_tier)
  IN ('foundational', 'beginners', 'community')
  AND c.id NOT IN (SELECT id FROM canonical);

-- Normalise names + tiers on the surviving rows
UPDATE public.courses
SET
  name = 'Foundational Course',
  required_tier = 'foundational',
  display_order = 1
WHERE public.course_effective_tier(name, required_tier) = 'foundational';

UPDATE public.courses
SET
  name = 'Beginners Course',
  required_tier = 'beginners',
  display_order = 2
WHERE public.course_effective_tier(name, required_tier) = 'beginners';

UPDATE public.courses
SET
  name = 'Kidda Community',
  required_tier = 'community',
  display_order = 3
WHERE public.course_effective_tier(name, required_tier) = 'community';

-- Prevent future duplicates (run after dedupe above)
CREATE UNIQUE INDEX IF NOT EXISTS courses_required_tier_unique
  ON public.courses (required_tier)
  WHERE required_tier IN ('foundational', 'beginners', 'community');

NOTIFY pgrst, 'reload schema';

-- Verify: should return exactly 3 rows
-- SELECT name, required_tier FROM public.courses ORDER BY display_order;
