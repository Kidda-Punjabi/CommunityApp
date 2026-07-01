-- Reclassify group-package calendar sessions that were incorrectly stored as 1-to-1.
-- Uses course_enrollments.delivery_mode as source of truth (not attendee count).
-- Safe to re-run. Tutors should sync Google Calendar after applying.

UPDATE public.tutor_scheduled_sessions AS s
SET
  cohort_id = ce.cohort_id,
  student_id = NULL,
  rescheduling_allowed = false,
  updated_at = now()
FROM public.course_enrollments AS ce
WHERE s.student_id = ce.user_id
  AND s.tutor_id = ce.tutor_id
  AND ce.delivery_mode = 'group'::public.delivery_mode
  AND ce.cohort_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
