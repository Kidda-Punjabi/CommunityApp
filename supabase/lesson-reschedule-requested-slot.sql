-- Student-selected alternative time on 1-to-1 reschedule requests.

ALTER TABLE public.lesson_reschedule_requests
  ADD COLUMN IF NOT EXISTS requested_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS requested_ends_at TIMESTAMPTZ;

COMMENT ON COLUMN public.lesson_reschedule_requests.requested_starts_at IS
  'Student-picked alternative slot start (from tutor availability).';
COMMENT ON COLUMN public.lesson_reschedule_requests.requested_ends_at IS
  'Student-picked alternative slot end (from tutor availability).';

NOTIFY pgrst, 'reload schema';
