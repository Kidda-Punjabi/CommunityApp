-- =============================================================================
-- Backfill topic_mastery from lesson_progress fallback encoding
-- (Everyday Punjabi / Community course only).
-- Run AFTER supabase/topic-mastery.sql.
--
-- Encoding used by the old fallback:
--   last_page_viewed = mastery units 0–15
--   total_pages      = in-stage progress_percent (0–100)
-- Rows with last_page_viewed > 15 are treated as real PDF page numbers and skipped.
-- =============================================================================

INSERT INTO public.topic_mastery (
  user_id,
  lesson_id,
  mastery_level,
  progress_percent,
  stage,
  depth
)
SELECT
  lp.user_id,
  lp.lesson_id,
  units.units AS mastery_level,
  CASE
    WHEN lp.total_pages IS NOT NULL
      AND lp.total_pages >= 0
      AND lp.total_pages <= 100
      THEN lp.total_pages
    WHEN units.units >= 15 THEN 100
    ELSE 0
  END AS progress_percent,
  CASE
    WHEN units.units >= 15 THEN 3
    ELSE (units.units / 5) + 1
  END AS stage,
  CASE
    WHEN units.units >= 15 THEN 5
    ELSE units.units % 5
  END AS depth
FROM public.lesson_progress lp
INNER JOIN public.lessons l ON l.id = lp.lesson_id
CROSS JOIN LATERAL (
  SELECT
    CASE
      WHEN lp.last_page_viewed IS NOT NULL
        AND lp.last_page_viewed > 0
        AND lp.last_page_viewed <= 15
        THEN LEAST(15, GREATEST(0, lp.last_page_viewed::integer))
      WHEN lp.last_position IS NOT NULL
        AND lp.last_position > 0
        AND lp.last_position <= 5
        THEN lp.last_position::integer
      WHEN lp.completed IS TRUE THEN 1
      ELSE 0
    END AS units
) units
WHERE l.course_id = '22f0e217-92a7-46f0-b38e-651409d7d118'
  AND units.units > 0
  AND (lp.last_page_viewed IS NULL OR lp.last_page_viewed <= 15)
ON CONFLICT (user_id, lesson_id) DO UPDATE
SET
  mastery_level = EXCLUDED.mastery_level,
  progress_percent = EXCLUDED.progress_percent,
  stage = EXCLUDED.stage,
  depth = EXCLUDED.depth,
  updated_at = now();
