-- Explicit curriculum week on scheduled cohort class sessions (lessons.lesson_number sequence).
-- Used for cohort switch alternate-session matching. Run after tutor-google-calendar.sql.

ALTER TABLE public.tutor_scheduled_sessions
  ADD COLUMN IF NOT EXISTS week_number INTEGER;

COMMENT ON COLUMN public.tutor_scheduled_sessions.week_number IS
  'Curriculum week for cohort class sessions (aligned with lessons.lesson_number). NULL when ambiguous.';

CREATE INDEX IF NOT EXISTS idx_tutor_scheduled_sessions_course_week_starts
  ON public.tutor_scheduled_sessions (course_id, week_number, starts_at)
  WHERE cohort_id IS NOT NULL AND week_number IS NOT NULL;

-- Initial SQL backfill is conservative; run scripts/refresh-cohort-session-week-numbers.ts
-- after deploy for cohort class sessions using completed log counts + upcoming sequence.

NOTIFY pgrst, 'reload schema';
