-- Group cohort checkout: cohorts may not have tutor_id until admin/Notion sync.
-- Allow course_enrollments.tutor_id NULL for Beginners group (UI already treats as pending_setup).

ALTER TABLE public.course_enrollments
  ALTER COLUMN tutor_id DROP NOT NULL;

COMMENT ON COLUMN public.course_enrollments.tutor_id IS
  'Assigned tutor. NULL allowed for Beginners group when cohort tutor is not set yet.';