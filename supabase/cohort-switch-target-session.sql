-- Store the specific alternate session a student requested for a cohort switch.
-- Run after cohort-switch-requests.sql.

ALTER TABLE public.cohort_switch_requests
  ADD COLUMN IF NOT EXISTS to_session_id UUID REFERENCES public.tutor_scheduled_sessions (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cohort_switch_requests_to_session
  ON public.cohort_switch_requests (to_session_id);

COMMENT ON COLUMN public.cohort_switch_requests.to_session_id IS
  'Specific alternate tutor_scheduled_sessions row the student requested for the same lesson/week.';

NOTIFY pgrst, 'reload schema';
