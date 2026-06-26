-- =============================================================================
-- Kidda — Private lesson visibility (tutor + invited students only)
-- Run after tutor-google-calendar.sql
-- =============================================================================
--
-- Rules:
--   • Tutors only see their own synced sessions (existing RLS policy).
--   • 1:1 lessons: only the matched student, if on the Google invite.
--   • Group lessons: only cohort members on the Google invite.
--   • Student must be enrolled with that tutor.

CREATE OR REPLACE FUNCTION public.user_email_lower(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(email) FROM auth.users WHERE id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.student_on_session_attendee_list(
  p_user_id UUID,
  p_attendee_emails TEXT[]
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_attendee_emails, '{}')) AS attendee(email)
    WHERE lower(trim(attendee.email)) = COALESCE(public.user_email_lower(p_user_id), '')
  );
$$;

CREATE OR REPLACE FUNCTION public.student_can_view_session(p_session_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tutor_scheduled_sessions s
    WHERE s.id = p_session_id
      AND s.status = 'scheduled'
      AND s.match_method IN ('attendee_email', 'manual')
      AND public.student_enrolled_with_tutor(p_user_id, s.tutor_id)
      AND public.student_on_session_attendee_list(p_user_id, s.attendee_emails)
      AND (
        s.student_id = p_user_id
        OR (
          s.student_id IS NULL
          AND s.cohort_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.cohort_members cm
            WHERE cm.cohort_id = s.cohort_id
              AND cm.user_id = p_user_id
              AND cm.left_at IS NULL
          )
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_email_lower(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_on_session_attendee_list(UUID, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_can_view_session(UUID, UUID) TO authenticated;

-- Fix existing 1:1 rows that incorrectly inherited a cohort_id (leaked to whole cohort).
UPDATE public.tutor_scheduled_sessions
SET cohort_id = NULL
WHERE student_id IS NOT NULL
  AND cohort_id IS NOT NULL;
