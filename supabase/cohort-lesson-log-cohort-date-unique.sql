-- =============================================================================
-- Kidda — One cohort lesson-log row per (cohort_id, lesson_date)
-- Run in Supabase SQL Editor (project: pztubczhqkzcwtkstpgi)
--
-- Do not apply while duplicate groups exist. As of 2026-08-17:
--   Cohort 6 (64176405-bd2d-44fe-9d43-9d84ec569b96) 2025-12-17 — 3 rows
--   Cohort 8 (1b7c77d6-1a81-4ccf-9d44-ecfb8c877c6d) 2025-12-17 — 4 rows
-- Resolve those first. This script refuses to create the index if any remain.
-- 1:1 rows (cohort_id IS NULL) are excluded from the unique index.
-- =============================================================================

DO $$
DECLARE
  dup_summary text;
BEGIN
  SELECT string_agg(
    format('%s %s (%s rows)', cohort_id, lesson_date, n),
    ', '
    ORDER BY lesson_date, cohort_id::text
  )
  INTO dup_summary
  FROM (
    SELECT cohort_id, lesson_date, COUNT(*) AS n
    FROM public.cohort_lesson_log_entries
    WHERE cohort_id IS NOT NULL
    GROUP BY cohort_id, lesson_date
    HAVING COUNT(*) > 1
  ) d;

  IF dup_summary IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot add cohort_lesson_log_entries_cohort_date_unique; duplicate (cohort_id, lesson_date) groups: %',
      dup_summary;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS cohort_lesson_log_entries_cohort_date_unique
ON cohort_lesson_log_entries (cohort_id, lesson_date)
WHERE cohort_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
