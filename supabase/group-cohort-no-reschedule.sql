-- Group cohort sessions cannot be rescheduled — only alternate cohort requests apply.
-- Safe to re-run.

UPDATE public.tutor_scheduled_sessions
SET
  rescheduling_allowed = false,
  updated_at = now()
WHERE cohort_id IS NOT NULL
  AND rescheduling_allowed = true;

COMMENT ON COLUMN public.tutor_scheduled_sessions.rescheduling_allowed IS
  'When false, students cannot request a reschedule. Always false for group cohort sessions.';

NOTIFY pgrst, 'reload schema';
