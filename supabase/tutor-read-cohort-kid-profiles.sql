-- Tutors can read kid names on cohorts they manage.
-- Attendance was falling back to "Student" because kid_profiles SELECT is
-- otherwise parent-only.

CREATE OR REPLACE FUNCTION public.tutor_can_read_kid_profile(p_kid_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_master_admin()
    OR public.is_community_lead()
    OR (
      public.parent_owns_kid_profile(p_kid_profile_id)
    )
    OR (
      public.is_tutor()
      AND (
        EXISTS (
          SELECT 1
          FROM public.course_enrollments ce
          WHERE ce.kid_profile_id = p_kid_profile_id
            AND ce.tutor_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1
          FROM public.cohort_members cm
          WHERE cm.kid_profile_id = p_kid_profile_id
            AND cm.left_at IS NULL
            AND public.tutor_can_manage_cohort(cm.cohort_id)
        )
        OR EXISTS (
          SELECT 1
          FROM public.cohort_members cm
          JOIN public.kid_profiles kp ON kp.parent_user_id = cm.user_id
          WHERE kp.id = p_kid_profile_id
            AND cm.left_at IS NULL
            AND public.tutor_can_manage_cohort(cm.cohort_id)
        )
      )
    );
$$;

COMMENT ON FUNCTION public.tutor_can_read_kid_profile(uuid) IS
  'True when the current user may read this kid profile for tutor roster / attendance labels.';

GRANT EXECUTE ON FUNCTION public.tutor_can_read_kid_profile(uuid) TO authenticated;

DROP POLICY IF EXISTS "Tutors read cohort kid profiles" ON public.kid_profiles;
CREATE POLICY "Tutors read cohort kid profiles"
  ON public.kid_profiles FOR SELECT TO authenticated
  USING (public.tutor_can_read_kid_profile(id));

NOTIFY pgrst, 'reload schema';
