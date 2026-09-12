-- Parent "how your kids are doing" summary.
-- Mirrors get_course_progress: SECURITY DEFINER, auth.uid() must be the kid's parent.

CREATE OR REPLACE FUNCTION public.get_kid_progress_summary(p_kid_profile_id UUID)
RETURNS TABLE (
  kid_profile_id UUID,
  kid_name TEXT,
  avatar_icon TEXT,
  course_id UUID,
  course_name TEXT,
  course_level TEXT,
  attendance_present INTEGER,
  attendance_total INTEGER,
  outstanding_homework_title TEXT,
  outstanding_homework_due_at DATE,
  latest_tutor_note TEXT,
  latest_tutor_note_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent UUID;
  v_name TEXT;
  v_icon TEXT;
  v_course_id UUID;
  v_course_name TEXT;
  v_course_level TEXT;
  v_cohort_id UUID;
  v_present INTEGER := 0;
  v_total INTEGER := 0;
  v_hw_title TEXT;
  v_hw_due DATE;
  v_note TEXT;
  v_note_at TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT kp.parent_user_id, kp.name, kp.avatar_icon
  INTO v_parent, v_name, v_icon
  FROM public.kid_profiles kp
  WHERE kp.id = p_kid_profile_id;

  IF v_parent IS NULL OR v_parent IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT ce.course_id, co.name, co.required_tier::TEXT, ce.cohort_id
  INTO v_course_id, v_course_name, v_course_level, v_cohort_id
  FROM public.course_enrollments ce
  JOIN public.courses co ON co.id = ce.course_id
  WHERE ce.kid_profile_id = p_kid_profile_id
  ORDER BY ce.created_at DESC
  LIMIT 1;

  -- Prefer kid_profile_id. Also accept older parent-keyed rows that belong to
  -- this kid's course/cohort (XOR actor columns). Never mix in the parent's
  -- other adult courses.
  SELECT
    COUNT(*) FILTER (WHERE a.attended IS TRUE)::INTEGER,
    COUNT(*)::INTEGER
  INTO v_present, v_total
  FROM public.cohort_lesson_attendance a
  WHERE a.kid_profile_id = p_kid_profile_id
     OR (
       a.kid_profile_id IS NULL
       AND v_parent IS NOT NULL
       AND a.student_id = v_parent
       AND v_cohort_id IS NOT NULL
       AND a.cohort_id = v_cohort_id
     );

  -- Outstanding = earliest happened lesson with no non-practice submission.
  -- Due date comes from the lesson log date (homework_submissions has no due column).
  SELECT l.title, log.lesson_date
  INTO v_hw_title, v_hw_due
  FROM public.cohort_lesson_log_entries log
  JOIN public.lessons l ON l.id = log.lesson_id
  WHERE v_cohort_id IS NOT NULL
    AND log.cohort_id = v_cohort_id
    AND log.lesson_id IS NOT NULL
    AND log.lesson_date <= CURRENT_DATE
    AND COALESCE(log.status, '') <> 'Cancelled'
    AND NOT EXISTS (
      SELECT 1
      FROM public.homework_submissions hs
      WHERE hs.lesson_id = log.lesson_id
        AND hs.is_practice = false
        AND (
          hs.kid_profile_id = p_kid_profile_id
          OR (
            hs.kid_profile_id IS NULL
            AND hs.student_id = v_parent
            AND v_course_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.lessons hl
              WHERE hl.id = hs.lesson_id AND hl.course_id = v_course_id
            )
          )
        )
    )
  ORDER BY log.lesson_date ASC, l.lesson_number ASC
  LIMIT 1;

  SELECT n.note, n.noted_at
  INTO v_note, v_note_at
  FROM (
    SELECT hs.tutor_comment AS note,
           COALESCE(hs.reviewed_at, hs.submitted_at) AS noted_at
    FROM public.homework_submissions hs
    JOIN public.lessons hl ON hl.id = hs.lesson_id
    WHERE hs.tutor_comment IS NOT NULL
      AND btrim(hs.tutor_comment) <> ''
      AND (
        hs.kid_profile_id = p_kid_profile_id
        OR (
          hs.kid_profile_id IS NULL
          AND hs.student_id = v_parent
          AND v_course_id IS NOT NULL
          AND hl.course_id = v_course_id
        )
      )
    UNION ALL
    SELECT a.tutor_note AS note, a.updated_at AS noted_at
    FROM public.cohort_lesson_attendance a
    WHERE a.tutor_note IS NOT NULL
      AND btrim(a.tutor_note) <> ''
      AND (
        a.kid_profile_id = p_kid_profile_id
        OR (
          a.kid_profile_id IS NULL
          AND v_parent IS NOT NULL
          AND a.student_id = v_parent
          AND v_cohort_id IS NOT NULL
          AND a.cohort_id = v_cohort_id
        )
      )
  ) n
  ORDER BY n.noted_at DESC NULLS LAST
  LIMIT 1;

  kid_profile_id := p_kid_profile_id;
  kid_name := v_name;
  avatar_icon := v_icon;
  course_id := v_course_id;
  course_name := v_course_name;
  course_level := v_course_level;
  attendance_present := v_present;
  attendance_total := v_total;
  outstanding_homework_title := v_hw_title;
  outstanding_homework_due_at := v_hw_due;
  latest_tutor_note := v_note;
  latest_tutor_note_at := v_note_at;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_kid_progress_summary(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
