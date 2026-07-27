-- =============================================================================
-- Link cohort_lesson_log_entries to curriculum lessons (lessons.id).
-- Position among non-cancelled entries → lesson_number in cohort course.
-- Run after cohort-lesson-log-entries.sql.
-- =============================================================================

ALTER TABLE public.cohort_lesson_log_entries
  ADD COLUMN IF NOT EXISTS lesson_id UUID REFERENCES public.lessons (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.cohort_lesson_log_entries.lesson_id IS
  'Curriculum lesson for this session (derived from sequential non-cancelled log position).';

CREATE INDEX IF NOT EXISTS idx_cohort_lesson_log_entries_lesson_id
  ON public.cohort_lesson_log_entries (lesson_id)
  WHERE lesson_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_cohort_lesson_log_lesson_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.lesson_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.cohort_id IS NULL THEN
    RAISE EXCEPTION 'lesson_id on lesson log entries is only supported for cohort rows.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.lessons l
    JOIN public.cohorts co ON co.id = NEW.cohort_id
    WHERE l.id = NEW.lesson_id
      AND l.course_id = co.course_id
  ) THEN
    RAISE EXCEPTION 'lesson_id must belong to the cohort''s course.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cohort_lesson_log_lesson_scope ON public.cohort_lesson_log_entries;
CREATE TRIGGER trg_cohort_lesson_log_lesson_scope
  BEFORE INSERT OR UPDATE OF lesson_id, cohort_id ON public.cohort_lesson_log_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_cohort_lesson_log_lesson_scope();

NOTIFY pgrst, 'reload schema';
