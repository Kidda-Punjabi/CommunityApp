-- Tutor "Log a lesson" sweep.
-- 1-1 attendance stays on cohort_lesson_attendance (no new table):
-- cohort_id becomes nullable, package_instance_id is the 1-1 target.
-- Exactly one of cohort_id / package_instance_id is set.

ALTER TABLE public.cohort_lesson_attendance
  ADD COLUMN IF NOT EXISTS package_instance_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cohort_lesson_attendance_package_instance_id_fkey'
  ) THEN
    ALTER TABLE public.cohort_lesson_attendance
      ADD CONSTRAINT cohort_lesson_attendance_package_instance_id_fkey
      FOREIGN KEY (package_instance_id) REFERENCES public.package_instances (id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.cohort_lesson_attendance
  ALTER COLUMN cohort_id DROP NOT NULL;

ALTER TABLE public.cohort_lesson_attendance
  DROP CONSTRAINT IF EXISTS cohort_lesson_attendance_target_check;

ALTER TABLE public.cohort_lesson_attendance
  ADD CONSTRAINT cohort_lesson_attendance_target_check CHECK (
    (cohort_id IS NOT NULL AND package_instance_id IS NULL)
    OR (cohort_id IS NULL AND package_instance_id IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS cohort_lesson_attendance_pkg_user_key
  ON public.cohort_lesson_attendance (package_instance_id, lesson_id, student_id)
  WHERE package_instance_id IS NOT NULL AND student_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS cohort_lesson_attendance_pkg_kid_key
  ON public.cohort_lesson_attendance (package_instance_id, lesson_id, kid_profile_id)
  WHERE package_instance_id IS NOT NULL AND kid_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cohort_lesson_attendance_package_lesson
  ON public.cohort_lesson_attendance (package_instance_id, lesson_id);

CREATE OR REPLACE FUNCTION public.enforce_cohort_lesson_attendance_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.cohort_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.lessons l
      JOIN public.cohorts co ON co.id = NEW.cohort_id
      WHERE l.id = NEW.lesson_id
        AND l.course_id = co.course_id
    ) THEN
      RAISE EXCEPTION 'lesson_id must belong to the cohort''s course.';
    END IF;
  ELSIF NEW.package_instance_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.lessons l
      JOIN public.package_instances pi ON pi.id = NEW.package_instance_id
      WHERE l.id = NEW.lesson_id
        AND l.course_id = pi.course_id
    ) THEN
      RAISE EXCEPTION 'lesson_id must belong to the package''s course.';
    END IF;
  ELSE
    RAISE EXCEPTION 'Attendance needs a cohort or a package.';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Atomic app-side log: lesson row, attendance, unlock, optional recording.
-- Notion is written by the server after this returns. notion_page_id starts as pending-<uuid>.
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
