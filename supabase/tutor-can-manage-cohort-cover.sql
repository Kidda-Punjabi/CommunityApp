-- =============================================================================
-- Kidda — Covering tutors can manage the cohort they are covering
--
-- Live schema (confirmed 2026-08-31):
--   tutor_scheduled_sessions.cohort_id exists
--   tutor_cover_requests.status IN (
--     pending_assignment, assigned, declined, confirmed, cancelled, needs_admin
--   )
-- There is no 'accepted' status. A covering tutor is:
--   assigned  = in the 48h decline window (they may still teach)
--   confirmed = window elapsed without decline (auto-confirmed)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tutor_can_manage_cohort(p_cohort_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_master_admin()
    OR EXISTS (
      SELECT 1
      FROM public.cohorts co
      WHERE co.id = p_cohort_id
        AND co.tutor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.course_enrollments ce
      WHERE ce.cohort_id = p_cohort_id
        AND ce.tutor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.tutor_cover_requests cr
      JOIN public.tutor_scheduled_sessions s ON s.id = cr.session_id
      WHERE s.cohort_id = p_cohort_id
        AND cr.assigned_tutor_id = auth.uid()
        AND cr.status IN ('assigned', 'confirmed')
    );
$$;

GRANT EXECUTE ON FUNCTION public.tutor_can_manage_cohort(UUID) TO authenticated;

-- Covering tutors cannot RLS-read the original tutor's scheduled session, so they
-- cannot discover cohort_id via PostgREST embeds. This helper only returns ids
-- for auth.uid()'s assigned/confirmed covers.
CREATE OR REPLACE FUNCTION public.tutor_cover_cohort_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT s.cohort_id
  FROM public.tutor_cover_requests cr
  JOIN public.tutor_scheduled_sessions s ON s.id = cr.session_id
  WHERE cr.assigned_tutor_id = auth.uid()
    AND cr.status IN ('assigned', 'confirmed')
    AND s.cohort_id IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_cover_cohort_ids() TO authenticated;

NOTIFY pgrst, 'reload schema';
