-- =============================================================================
-- Kidda — Lesson Log manual-override sources (mirrors cohorts.tutor_id_source)
-- Run in Supabase SQL Editor after cohort-lesson-log-admin.sql
-- =============================================================================
-- notion = field last came from Notion pull (pull may update)
-- manual = admin override in Lesson Log UI (pull skips that field)

ALTER TABLE public.cohort_lesson_log_entries
  ADD COLUMN IF NOT EXISTS status_source text NOT NULL DEFAULT 'notion',
  ADD COLUMN IF NOT EXISTS reviewed_source text NOT NULL DEFAULT 'notion',
  ADD COLUMN IF NOT EXISTS notes_source text NOT NULL DEFAULT 'notion';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cohort_lesson_log_entries_status_source_check'
  ) THEN
    ALTER TABLE public.cohort_lesson_log_entries
      ADD CONSTRAINT cohort_lesson_log_entries_status_source_check
      CHECK (status_source IN ('notion', 'manual'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cohort_lesson_log_entries_reviewed_source_check'
  ) THEN
    ALTER TABLE public.cohort_lesson_log_entries
      ADD CONSTRAINT cohort_lesson_log_entries_reviewed_source_check
      CHECK (reviewed_source IN ('notion', 'manual'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cohort_lesson_log_entries_notes_source_check'
  ) THEN
    ALTER TABLE public.cohort_lesson_log_entries
      ADD CONSTRAINT cohort_lesson_log_entries_notes_source_check
      CHECK (notes_source IN ('notion', 'manual'));
  END IF;
END $$;

COMMENT ON COLUMN public.cohort_lesson_log_entries.status_source IS
  'notion = last status came from Notion pull; manual = admin override (pull skips status).';
COMMENT ON COLUMN public.cohort_lesson_log_entries.reviewed_source IS
  'notion = last reviewed came from Notion pull; manual = admin override (pull skips reviewed).';
COMMENT ON COLUMN public.cohort_lesson_log_entries.notes_source IS
  'notion = last notes came from Notion pull; manual = admin override (pull skips notes).';

NOTIFY pgrst, 'reload schema';
