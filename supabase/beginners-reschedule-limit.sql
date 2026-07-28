-- Beginners course reschedule limit: students get 2 reschedules by default.
-- Admins can grant extra allowances per enrollment via extra_reschedule_allowance.

ALTER TABLE public.course_enrollments
  ADD COLUMN IF NOT EXISTS extra_reschedule_allowance INTEGER NOT NULL DEFAULT 0
  CHECK (extra_reschedule_allowance >= 0);

COMMENT ON COLUMN public.course_enrollments.extra_reschedule_allowance IS
  'Admin override: additional reschedule/cohort-switch requests beyond the default Beginners limit (2).';

NOTIFY pgrst, 'reload schema';
