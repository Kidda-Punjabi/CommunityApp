-- =============================================================================
-- Kidda — Allow match_method = 'calendar_link' for verified group-cohort linking
-- =============================================================================
-- Sessions created from the admin "New package" calendar-link flow bind to a
-- real Google Calendar occurrence. Distinct from sync guesses (title_name /
-- attendee_email) and from the older free-text/manual paths.

ALTER TABLE public.tutor_scheduled_sessions
  DROP CONSTRAINT IF EXISTS tutor_scheduled_sessions_match_method_check;

ALTER TABLE public.tutor_scheduled_sessions
  ADD CONSTRAINT tutor_scheduled_sessions_match_method_check
  CHECK (
    match_method = ANY (
      ARRAY[
        'attendee_email'::text,
        'title_name'::text,
        'manual'::text,
        'unmatched'::text,
        'calendar_link'::text
      ]
    )
  );

COMMENT ON COLUMN public.tutor_scheduled_sessions.match_method IS
  'How the session was associated: attendee_email/title_name from calendar sync, manual from admin tools or 1-1 booking, calendar_link from verified group-cohort package creation, unmatched if none.';

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
      AND s.match_method IN ('attendee_email', 'manual', 'calendar_link')
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
