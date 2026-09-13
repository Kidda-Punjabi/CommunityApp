-- Allow master admins to issue certificates even when they are not the
-- assigned cohort/enrollment tutor. The INSERT policy already requires
-- is_tutor() OR is_master_admin(); this helper was still blocking admins.

CREATE OR REPLACE FUNCTION public.tutor_can_issue_certificate(
  p_tutor_id uuid,
  p_profile_id uuid,
  p_kid_profile_id uuid,
  p_level text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_master_admin()
    OR EXISTS (
      SELECT 1
      FROM public.course_enrollments e
      JOIN public.courses co ON co.id = e.course_id
      LEFT JOIN public.cohorts c ON c.id = e.cohort_id
      WHERE (e.tutor_id = p_tutor_id OR c.tutor_id = p_tutor_id)
        AND (
          (p_profile_id IS NOT NULL AND e.user_id = p_profile_id)
          OR (p_kid_profile_id IS NOT NULL AND e.kid_profile_id = p_kid_profile_id)
        )
        AND (
          (p_level = 'beginner' AND (co.required_tier = 'beginners' OR co.content_track = 'kids'))
          OR (p_level = 'intermediate' AND co.required_tier = 'intermediate')
          OR (p_level = 'advanced' AND co.required_tier = 'advanced')
        )
    );
$$;
