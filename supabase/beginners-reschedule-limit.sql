-- Beginners course reschedule limit: students get 4 reschedules by default.
-- Admins can grant extra allowances per enrollment via extra_reschedule_allowance.

ALTER TABLE public.course_enrollments
  ADD COLUMN IF NOT EXISTS extra_reschedule_allowance INTEGER NOT NULL DEFAULT 0
  CHECK (extra_reschedule_allowance >= 0);

COMMENT ON COLUMN public.course_enrollments.extra_reschedule_allowance IS
  'Admin override: additional requests beyond the default Beginners limit (4), applied to the enrollment delivery mode only — group alternate-cohort or 1-to-1 reschedule.';

NOTIFY pgrst, 'reload schema';
