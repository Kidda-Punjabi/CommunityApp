-- Per-cohort default: logging a session auto-unlocks curriculum content in Learn.
ALTER TABLE public.cohorts
  ADD COLUMN IF NOT EXISTS auto_unlock_on_log BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.cohorts.auto_unlock_on_log IS
  'When true (default), app-side lesson log creates cohort_lesson_unlocks for the linked lesson_id. Tutors/admins can turn off per cohort.';

NOTIFY pgrst, 'reload schema';
