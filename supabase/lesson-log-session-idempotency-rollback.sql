-- One-step rollback for supabase/lesson-log-session-idempotency.sql
-- and the needs_review change in supabase/kid-progress-summary.sql.
--
-- Restores the previous apply_tutor_lesson_log and get_kid_progress_summary,
-- then drops the indexes and columns added for calendar idempotency.
-- Does not delete or update lesson log rows. Values stored only in the new
-- columns are removed with those columns.

DROP FUNCTION IF EXISTS public.apply_tutor_lesson_log(
  uuid, uuid, uuid, text, date, text, text, uuid, text, text, jsonb, uuid,
  text, text[], uuid, timestamptz, text, boolean, text, uuid, text, boolean, uuid
);

CREATE OR REPLACE FUNCTION public.apply_tutor_lesson_log(
  p_cohort_id uuid,
  p_package_instance_id uuid,
  p_lesson_id uuid,
  p_lesson_title text,
  p_lesson_date date,
  p_recording_url text,
  p_notes text,
  p_logged_by uuid,
  p_notion_page_id text,
  p_notion_tutor_user_id text,
  p_attendance jsonb,
  p_recording_student_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_row jsonb;
  v_student uuid;
  v_kid uuid;
  v_attended boolean;
  v_notes text;
BEGIN
  IF (p_cohort_id IS NULL) = (p_package_instance_id IS NULL) THEN
    RAISE EXCEPTION 'Choose a cohort or a 1-1 package, not both.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.cohort_lesson_log_entries e
    WHERE e.lesson_id = p_lesson_id
      AND e.status IS DISTINCT FROM 'Cancelled'
      AND e.dismissed_at IS NULL
      AND (
        (p_cohort_id IS NOT NULL AND e.cohort_id = p_cohort_id)
        OR (p_package_instance_id IS NOT NULL AND e.package_instance_id = p_package_instance_id)
      )
  ) THEN
    RAISE EXCEPTION 'That lesson is already logged.';
  END IF;

  v_notes := NULLIF(btrim(COALESCE(p_notes, '')), '');

  INSERT INTO public.cohort_lesson_log_entries (
    cohort_id,
    package_instance_id,
    lesson_id,
    lesson_title,
    lesson_date,
    recording_url,
    notes,
    logged_by,
    source,
    notion_page_id,
    notion_tutor_user_id,
    notion_sync_status,
    notion_sync_error,
    status,
    status_source,
    reviewed,
    reviewed_source,
    notes_source,
    is_cover_session
  ) VALUES (
    p_cohort_id,
    p_package_instance_id,
    p_lesson_id,
    btrim(p_lesson_title),
    p_lesson_date,
    NULLIF(btrim(COALESCE(p_recording_url, '')), ''),
    v_notes,
    p_logged_by,
    'app',
    p_notion_page_id,
    NULLIF(btrim(COALESCE(p_notion_tutor_user_id, '')), ''),
    'pending',
    NULL,
    'Completed',
    'manual',
    false,
    'notion',
    CASE WHEN v_notes IS NULL THEN 'notion' ELSE 'manual' END,
    false
  )
  RETURNING id INTO v_id;

  FOR v_row IN SELECT value FROM jsonb_array_elements(COALESCE(p_attendance, '[]'::jsonb))
  LOOP
    v_student := NULLIF(v_row->>'studentId', '')::uuid;
    v_kid := NULLIF(v_row->>'kidProfileId', '')::uuid;
    v_attended := COALESCE((v_row->>'attended')::boolean, true);

    INSERT INTO public.cohort_lesson_attendance (
      cohort_id,
      package_instance_id,
      lesson_id,
      student_id,
      kid_profile_id,
      attended,
      marked_by
    ) VALUES (
      p_cohort_id,
      p_package_instance_id,
      p_lesson_id,
      v_student,
      v_kid,
      v_attended,
      p_logged_by
    );
  END LOOP;

  IF p_cohort_id IS NOT NULL THEN
    INSERT INTO public.cohort_lesson_unlocks (cohort_id, lesson_id, unlocked_by)
    VALUES (p_cohort_id, p_lesson_id, p_logged_by)
    ON CONFLICT (cohort_id, lesson_id) DO NOTHING;
  ELSE
    FOR v_row IN SELECT value FROM jsonb_array_elements(COALESCE(p_attendance, '[]'::jsonb))
    LOOP
      v_student := NULLIF(v_row->>'studentId', '')::uuid;
      v_kid := NULLIF(v_row->>'kidProfileId', '')::uuid;
      IF v_kid IS NOT NULL THEN
        INSERT INTO public.student_lesson_unlocks (student_id, kid_profile_id, lesson_id, unlocked_by)
        VALUES (NULL, v_kid, p_lesson_id, p_logged_by)
        ON CONFLICT (kid_profile_id, lesson_id) DO NOTHING;
      ELSIF v_student IS NOT NULL THEN
        INSERT INTO public.student_lesson_unlocks (student_id, kid_profile_id, lesson_id, unlocked_by)
        VALUES (v_student, NULL, p_lesson_id, p_logged_by)
        ON CONFLICT (student_id, lesson_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  IF NULLIF(btrim(COALESCE(p_recording_url, '')), '') IS NOT NULL THEN
    IF p_cohort_id IS NOT NULL THEN
      INSERT INTO public.lesson_recordings (
        lesson_id, student_id, cohort_id, storage_path, uploaded_by, lesson_log_entry_id, updated_at
      ) VALUES (
        p_lesson_id, NULL, p_cohort_id, btrim(p_recording_url), p_logged_by, v_id, now()
      )
      ON CONFLICT (lesson_id, cohort_id) WHERE cohort_id IS NOT NULL
      DO UPDATE SET
        storage_path = EXCLUDED.storage_path,
        uploaded_by = EXCLUDED.uploaded_by,
        lesson_log_entry_id = EXCLUDED.lesson_log_entry_id,
        updated_at = now();
    ELSIF p_recording_student_id IS NOT NULL THEN
      INSERT INTO public.lesson_recordings (
        lesson_id, student_id, cohort_id, storage_path, uploaded_by, lesson_log_entry_id, updated_at
      ) VALUES (
        p_lesson_id, p_recording_student_id, NULL, btrim(p_recording_url), p_logged_by, v_id, now()
      )
      ON CONFLICT (lesson_id, student_id) WHERE student_id IS NOT NULL
      DO UPDATE SET
        storage_path = EXCLUDED.storage_path,
        uploaded_by = EXCLUDED.uploaded_by,
        lesson_log_entry_id = EXCLUDED.lesson_log_entry_id,
        updated_at = now();
    END IF;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_tutor_lesson_log(
  uuid, uuid, uuid, text, date, text, text, uuid, text, text, jsonb, uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_tutor_lesson_log(
  uuid, uuid, uuid, text, date, text, text, uuid, text, text, jsonb, uuid
) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_tutor_lesson_log(
  uuid, uuid, uuid, text, date, text, text, uuid, text, text, jsonb, uuid
) TO service_role;

-- Parent "how your kids are doing" summary.
-- Mirrors get_course_progress: SECURITY DEFINER, auth.uid() must be the kid's parent.
--
-- current_level_label comes from course_enrollments.level_number (1–3, kids only).

DROP FUNCTION IF EXISTS public.get_kid_progress_summary(UUID);

CREATE FUNCTION public.get_kid_progress_summary(p_kid_profile_id UUID)
RETURNS TABLE (
  kid_profile_id UUID,
  kid_name TEXT,
  avatar_icon TEXT,
  course_id UUID,
  course_name TEXT,
  course_level TEXT,
  current_level_number INTEGER,
  current_level_label TEXT,
  current_week INTEGER,
  total_weeks INTEGER,
  homework_done INTEGER,
  homework_due INTEGER,
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
  v_start_date TIMESTAMPTZ;
  v_present INTEGER := 0;
  v_total INTEGER := 0;
  v_hw_title TEXT;
  v_hw_due DATE;
  v_hw_done INTEGER := 0;
  v_hw_due_count INTEGER := 0;
  v_note TEXT;
  v_note_at TIMESTAMPTZ;
  v_total_weeks INTEGER := 0;
  v_current_week INTEGER := 0;
  v_stored_week INTEGER;
  v_elapsed INTEGER := 0;
  v_level_number INTEGER;
  v_level_label TEXT;
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

  SELECT ce.course_id, co.name, co.required_tier::TEXT, ce.cohort_id, c.start_date, ce.level_number
  INTO v_course_id, v_course_name, v_course_level, v_cohort_id, v_start_date, v_level_number
  FROM public.course_enrollments ce
  JOIN public.courses co ON co.id = ce.course_id
  LEFT JOIN public.cohorts c ON c.id = ce.cohort_id
  WHERE ce.kid_profile_id = p_kid_profile_id
  ORDER BY ce.created_at DESC
  LIMIT 1;

  IF v_level_number IS NOT NULL THEN
    v_level_label := 'Level ' || v_level_number::TEXT;
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO v_total_weeks
  FROM public.lessons l
  WHERE v_course_id IS NOT NULL
    AND l.course_id = v_course_id;

  SELECT s.week_number
  INTO v_stored_week
  FROM public.tutor_scheduled_sessions s
  WHERE v_cohort_id IS NOT NULL
    AND s.cohort_id = v_cohort_id
    AND COALESCE(s.status, '') <> 'cancelled'
    AND s.week_number IS NOT NULL
    AND s.starts_at >= NOW()
  ORDER BY s.starts_at ASC
  LIMIT 1;

  SELECT COUNT(*)::INTEGER
  INTO v_elapsed
  FROM public.tutor_scheduled_sessions s
  WHERE v_cohort_id IS NOT NULL
    AND s.cohort_id = v_cohort_id
    AND COALESCE(s.status, '') <> 'cancelled'
    AND s.starts_at <= NOW();

  IF v_course_id IS NULL THEN
    v_current_week := 0;
  ELSIF v_stored_week IS NOT NULL THEN
    v_current_week := LEAST(v_stored_week, GREATEST(v_total_weeks, 1));
  ELSIF v_start_date IS NOT NULL AND (v_start_date AT TIME ZONE 'UTC')::date > CURRENT_DATE THEN
    v_current_week := 1;
  ELSIF v_elapsed > 0 THEN
    v_current_week := LEAST(v_elapsed, GREATEST(v_total_weeks, 1));
  ELSE
    v_current_week := 1;
  END IF;

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

  SELECT COUNT(DISTINCT log.lesson_id)::INTEGER
  INTO v_hw_due_count
  FROM public.cohort_lesson_log_entries log
  WHERE v_cohort_id IS NOT NULL
    AND log.cohort_id = v_cohort_id
    AND log.lesson_id IS NOT NULL
    AND log.lesson_date <= CURRENT_DATE
    AND COALESCE(log.status, '') <> 'Cancelled';

  SELECT COUNT(DISTINCT hs.lesson_id)::INTEGER
  INTO v_hw_done
  FROM public.homework_submissions hs
  JOIN public.lessons hl ON hl.id = hs.lesson_id
  WHERE hs.is_practice = false
    AND v_course_id IS NOT NULL
    AND hl.course_id = v_course_id
    AND (
      hs.kid_profile_id = p_kid_profile_id
      OR (
        hs.kid_profile_id IS NULL
        AND hs.student_id = v_parent
      )
    )
    AND (
      v_cohort_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.cohort_lesson_log_entries log
        WHERE log.cohort_id = v_cohort_id
          AND log.lesson_id = hs.lesson_id
          AND log.lesson_date <= CURRENT_DATE
          AND COALESCE(log.status, '') <> 'Cancelled'
      )
    );

  -- Outstanding = earliest happened lesson with no non-practice submission.
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
  current_level_number := v_level_number;
  current_level_label := v_level_label;
  current_week := v_current_week;
  total_weeks := v_total_weeks;
  homework_done := v_hw_done;
  homework_due := v_hw_due_count;
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

DROP INDEX IF EXISTS public.cohort_lesson_log_entries_open_google_event_key;
DROP INDEX IF EXISTS public.cohort_lesson_log_entries_open_cohort_start_key;
DROP INDEX IF EXISTS public.cohort_lesson_log_entries_open_package_start_key;

ALTER TABLE public.cohort_lesson_log_entries
  DROP CONSTRAINT IF EXISTS cohort_lesson_log_entries_scheduled_session_id_fkey,
  DROP CONSTRAINT IF EXISTS cohort_lesson_log_entries_early_log_override_by_fkey,
  DROP CONSTRAINT IF EXISTS cohort_lesson_log_entries_needs_review_approved_by_fkey;

ALTER TABLE public.cohort_lesson_log_entries
  DROP COLUMN IF EXISTS google_event_id,
  DROP COLUMN IF EXISTS scheduled_session_id,
  DROP COLUMN IF EXISTS session_starts_at,
  DROP COLUMN IF EXISTS event_timezone,
  DROP COLUMN IF EXISTS needs_review,
  DROP COLUMN IF EXISTS needs_review_reason,
  DROP COLUMN IF EXISTS early_log_override_by,
  DROP COLUMN IF EXISTS early_log_override_reason,
  DROP COLUMN IF EXISTS early_log_overridden_at,
  DROP COLUMN IF EXISTS needs_review_approved_by,
  DROP COLUMN IF EXISTS needs_review_approved_at;

ALTER TABLE public.tutor_scheduled_sessions
  DROP COLUMN IF EXISTS event_timezone;

NOTIFY pgrst, 'reload schema';
