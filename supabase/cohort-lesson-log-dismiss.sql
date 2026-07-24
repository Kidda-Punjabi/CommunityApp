-- =============================================================================
-- Kidda — Lesson Log attention dismiss (unlinked historical entries)
-- Run in Supabase SQL Editor after cohort-lesson-log-admin.sql
-- =============================================================================

ALTER TABLE public.cohort_lesson_log_entries
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz,
  ADD COLUMN IF NOT EXISTS dismissed_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.cohort_lesson_log_entries.dismissed_at IS
  'Admin dismissed Needs attention for an unlinked entry (no Notion Package to resolve).';
COMMENT ON COLUMN public.cohort_lesson_log_entries.dismissed_by IS
  'Profile that dismissed this unlinked lesson log entry.';

CREATE INDEX IF NOT EXISTS idx_cohort_lesson_log_entries_unlinked_open
  ON public.cohort_lesson_log_entries (lesson_date DESC)
  WHERE cohort_id IS NULL
    AND package_instance_id IS NULL
    AND dismissed_at IS NULL;

NOTIFY pgrst, 'reload schema';
