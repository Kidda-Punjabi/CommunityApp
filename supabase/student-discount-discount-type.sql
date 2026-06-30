-- =============================================================================
-- Kidda — Add student / Blue Light discount type to verification requests
-- Run in Supabase SQL Editor after student-discount-requests.sql
-- =============================================================================

ALTER TABLE public.student_discount_requests
  ADD COLUMN IF NOT EXISTS discount_type TEXT NOT NULL DEFAULT 'student'
  CHECK (discount_type IN ('student', 'bluelight'));

COMMENT ON COLUMN public.student_discount_requests.discount_type IS
  'student = student ID verification; bluelight = Blue Light Card verification.';

ALTER TABLE public.student_discount_requests
  DROP CONSTRAINT IF EXISTS student_discount_requests_user_id_course_format_key;

ALTER TABLE public.student_discount_requests
  DROP CONSTRAINT IF EXISTS student_discount_requests_user_id_course_format_discount_type_key;

ALTER TABLE public.student_discount_requests
  ADD CONSTRAINT student_discount_requests_user_id_course_format_discount_type_key
  UNIQUE (user_id, course_format, discount_type);

NOTIFY pgrst, 'reload schema';
