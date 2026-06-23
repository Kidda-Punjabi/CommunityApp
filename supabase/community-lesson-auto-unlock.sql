-- =============================================================================
-- Kidda — Community members get all community lessons without per-lesson unlock
-- Run in Supabase SQL Editor (updates is_lesson_content_unlocked).
-- Safe to re-run.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_lesson_content_unlocked(
  p_user_id UUID,
  p_lesson_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_id UUID;
  v_tier TEXT
  v_course_name TEXT;
  v_is_free BOOLEAN;
  v_enrollment public.course_enrollments%ROWTYPE;
BEGIN
  SELECT l.course_id, l.is_free, c.required_tier, c.name
  INTO v_course_id, v_is_free, v_tier, v_course_name
  FROM public.lessons l
  JOIN public.courses c ON c.id = l.course_id
  WHERE l.id = p_lesson_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF COALESCE(v_is_free, false) THEN
    RETURN true;
  END IF;

  IF NOT public.user_has_course_access(p_user_id, v_course_id) THEN
    RETURN false;
  END IF;

  -- Community: course_access unlocks every lesson (no tutor/cohort unlock rows)
  IF COALESCE(v_tier, '') = 'community' OR COALESCE(v_course_name, '') ILIKE '%community%' THEN
    RETURN true;
  END IF;

  -- Foundational / Beginners: require enrollment + per-student or cohort unlock
  SELECT * INTO v_enrollment
  FROM public.course_enrollments ce
  WHERE ce.user_id = p_user_id
    AND ce.course_id = v_course_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_enrollment.delivery_mode = 'group'::public.delivery_mode THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.cohort_lesson_unlocks clu
      JOIN public.cohort_members cm
        ON cm.cohort_id = clu.cohort_id
       AND cm.user_id = p_user_id
       AND cm.left_at IS NULL
      WHERE clu.cohort_id = v_enrollment.cohort_id
        AND clu.lesson_id = p_lesson_id
    );
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.student_lesson_unlocks slu
    WHERE slu.student_id = p_user_id
      AND slu.lesson_id = p_lesson_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_lesson_content_unlocked(UUID, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
