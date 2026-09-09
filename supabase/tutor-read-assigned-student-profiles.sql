-- =============================================================================
-- Kidda — Tutors can read names of students assigned to them
-- Run after tutor-rls-scoping-fixes.sql
--
-- 1-1 assignment cards were falling back to "Student" because profiles SELECT
-- is otherwise own-row (plus a leaderboard USING true if that policy is present).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tutor_can_read_student_profile(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_profile_id = auth.uid()
    OR public.is_master_admin()
    OR public.is_community_lead()
    OR (
      public.is_tutor()
      AND (
        EXISTS (
          SELECT 1
          FROM public.course_enrollments ce
          WHERE ce.tutor_id = auth.uid()
            AND ce.user_id = p_profile_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.cohort_members cm
          WHERE cm.user_id = p_profile_id
            AND cm.left_at IS NULL
            AND public.tutor_can_manage_cohort(cm.cohort_id)
        )
        OR EXISTS (
          SELECT 1
          FROM public.student_packages sp
          JOIN public.package_instances pi ON pi.id = sp.package_instance_id
          WHERE sp.user_id = p_profile_id
            AND pi.tutor_id = auth.uid()
            AND sp.status IS DISTINCT FROM 'cancelled'
        )
      )
    );
$$;

COMMENT ON FUNCTION public.tutor_can_read_student_profile(uuid) IS
  'True when the current user may read this profile for tutor assignment / roster labels.';

GRANT EXECUTE ON FUNCTION public.tutor_can_read_student_profile(uuid) TO authenticated;

DROP POLICY IF EXISTS "Tutors read assigned student profiles" ON public.profiles;
CREATE POLICY "Tutors read assigned student profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.tutor_can_read_student_profile(id));

NOTIFY pgrst, 'reload schema';
