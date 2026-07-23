-- Course-scoped 1-to-1 session credits (run in Supabase SQL Editor if apply script unavailable).
-- Links each paid credit to the course/package it was purchased for, and snapshots the tutor
-- from the student's enrollment at purchase time.

ALTER TABLE public.tutor_one_to_one_booking_credits
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tutor_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.tutor_one_to_one_booking_credits.course_id IS
  'Course this session credit was purchased for (from Stripe checkout metadata / package).';
COMMENT ON COLUMN public.tutor_one_to_one_booking_credits.tutor_id IS
  'Tutor snapshot from the student enrollment for course_id at purchase time.';

CREATE INDEX IF NOT EXISTS idx_booking_credits_student_course_available
  ON public.tutor_one_to_one_booking_credits (student_id, course_id, purchased_at ASC)
  WHERE status = 'available';

NOTIFY pgrst, 'reload schema';
