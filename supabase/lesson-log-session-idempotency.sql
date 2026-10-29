-- Lesson log idempotency, calendar timezone, and review holds.
-- Does not update or delete existing cohort_lesson_log_entries rows.
-- Apply this file, then re-apply supabase/kid-progress-summary.sql
-- so homework counts ignore needs_review. Do not run the audit report as a migration.

ALTER TABLE public.tutor_scheduled_sessions
  ADD COLUMN IF NOT EXISTS event_timezone text;

COMMENT ON COLUMN public.tutor_scheduled_sessions.event_timezone IS
  'Google Calendar start.timeZone. Lesson pay dates use this, then Europe/London.';

ALTER TABLE public.cohort_lesson_log_entries
  ADD COLUMN IF NOT EXISTS google_event_id text,
  ADD COLUMN IF NOT EXISTS scheduled_session_id uuid,
  ADD COLUMN IF NOT EXISTS session_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS event_timezone text,
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS needs_review_reason text,
  ADD COLUMN IF NOT EXISTS early_log_override_by uuid,
  ADD COLUMN IF NOT EXISTS early_log_override_reason text,
  ADD COLUMN IF NOT EXISTS early_log_overridden_at timestamptz,
  ADD COLUMN IF NOT EXISTS needs_review_approved_by uuid,
  ADD COLUMN IF NOT EXISTS needs_review_approved_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cohort_lesson_log_entries_scheduled_session_id_fkey'
  ) THEN
    ALTER TABLE public.cohort_lesson_log_entries
      ADD CONSTRAINT cohort_lesson_log_entries_scheduled_session_id_fkey
      FOREIGN KEY (scheduled_session_id)
      REFERENCES public.tutor_scheduled_sessions (id)
      ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cohort_lesson_log_entries_early_log_override_by_fkey'
  ) THEN
    ALTER TABLE public.cohort_lesson_log_entries
      ADD CONSTRAINT cohort_lesson_log_entries_early_log_override_by_fkey
      FOREIGN KEY (early_log_override_by)
      REFERENCES public.profiles (id)
      ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cohort_lesson_log_entries_needs_review_approved_by_fkey'
  ) THEN
    ALTER TABLE public.cohort_lesson_log_entries
      ADD CONSTRAINT cohort_lesson_log_entries_needs_review_approved_by_fkey
      FOREIGN KEY (needs_review_approved_by)
      REFERENCES public.profiles (id)
      ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.cohort_lesson_log_entries.needs_review IS
  'Held for an admin. Not a pay date and not unlocked until approved on Admin → Lesson log.';
COMMENT ON COLUMN public.cohort_lesson_log_entries.needs_review_approved_by IS
  'Admin who approved a needs_review row so it counts for pay and unlocks.';
COMMENT ON COLUMN public.cohort_lesson_log_entries.early_log_override_reason IS
  'Required when an admin logs a class before its starts_at.';

-- One open log per calendar event, and one open log per class start.
-- Unmatched/personal events never receive these keys.
CREATE UNIQUE INDEX IF NOT EXISTS cohort_lesson_log_entries_open_google_event_key
  ON public.cohort_lesson_log_entries (google_event_id)
  WHERE dismissed_at IS NULL AND google_event_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS cohort_lesson_log_entries_open_cohort_start_key
  ON public.cohort_lesson_log_entries (cohort_id, session_starts_at)
  WHERE dismissed_at IS NULL AND cohort_id IS NOT NULL AND session_starts_at IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS cohort_lesson_log_entries_open_package_start_key
  ON public.cohort_lesson_log_entries (package_instance_id, session_starts_at)
  WHERE dismissed_at IS NULL
    AND package_instance_id IS NOT NULL
    AND session_starts_at IS NOT NULL;

DROP FUNCTION IF EXISTS public.apply_tutor_lesson_log(
  uuid, uuid, uuid, text, date, text, text, uuid, text, text, jsonb, uuid
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
  p_recording_student_id uuid,
  p_google_event_id text DEFAULT NULL,
  p_google_event_ids text[] DEFAULT NULL,
  p_scheduled_session_id uuid DEFAULT NULL,
  p_session_starts_at timestamptz DEFAULT NULL,
  p_event_timezone text DEFAULT NULL,
  p_needs_review boolean DEFAULT NULL,
  p_needs_review_reason text DEFAULT NULL,
  p_early_override_by uuid DEFAULT NULL,
  p_early_override_reason text DEFAULT NULL,
  p_is_cover_session boolean DEFAULT false,
  p_actual_tutor_id uuid DEFAULT NULL
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
  v_needs_review boolean;
  v_recording text;
  v_legacy_count integer;
  v_inserted boolean;
BEGIN
  IF (p_cohort_id IS NULL) = (p_package_instance_id IS NULL) THEN
    RAISE EXCEPTION 'Choose a cohort or a 1-1 package, not both.';
  END IF;

  IF p_session_starts_at IS NOT NULL AND p_session_starts_at > now() THEN
    IF p_early_override_by IS NULL
      OR NULLIF(btrim(COALESCE(p_early_override_reason, '')), '') IS NULL
    THEN
      RAISE EXCEPTION 'This lesson has not started yet.';
    END IF;
  END IF;

  v_needs_review := CASE
    WHEN p_google_event_id IS NULL AND p_session_starts_at IS NULL THEN true
    ELSE COALESCE(p_needs_review, false)
  END;
  v_notes := NULLIF(btrim(COALESCE(p_notes, '')), '');
  v_recording := NULLIF(btrim(COALESCE(p_recording_url, '')), '');

  SELECT e.id INTO v_id
  FROM public.cohort_lesson_log_entries e
  WHERE e.dismissed_at IS NULL
    AND (
      (p_google_event_id IS NOT NULL AND e.google_event_id = p_google_event_id)
      OR (
        p_google_event_ids IS NOT NULL
        AND e.google_event_id IS NOT NULL
        AND e.google_event_id = ANY (p_google_event_ids)
      )
      OR (
        p_cohort_id IS NOT NULL
        AND p_session_starts_at IS NOT NULL
        AND e.cohort_id = p_cohort_id
        AND e.session_starts_at = p_session_starts_at
      )
      OR (
        p_package_instance_id IS NOT NULL
        AND p_session_starts_at IS NOT NULL
        AND e.package_instance_id = p_package_instance_id
        AND e.session_starts_at = p_session_starts_at
      )
    )
  ORDER BY e.created_at ASC
  LIMIT 1;

  IF v_id IS NULL AND p_session_starts_at IS NOT NULL THEN
    SELECT COUNT(*) INTO v_legacy_count
    FROM public.cohort_lesson_log_entries e
    WHERE e.dismissed_at IS NULL
      AND e.google_event_id IS NULL
      AND e.session_starts_at IS NULL
      AND e.lesson_date = p_lesson_date
      AND (
        (p_cohort_id IS NOT NULL AND e.cohort_id = p_cohort_id)
        OR (p_package_instance_id IS NOT NULL AND e.package_instance_id = p_package_instance_id)
      );
    IF v_legacy_count = 1 THEN
      SELECT e.id INTO v_id
      FROM public.cohort_lesson_log_entries e
      WHERE e.dismissed_at IS NULL
        AND e.google_event_id IS NULL
        AND e.session_starts_at IS NULL
        AND e.lesson_date = p_lesson_date
        AND (
          (p_cohort_id IS NOT NULL AND e.cohort_id = p_cohort_id)
          OR (p_package_instance_id IS NOT NULL AND e.package_instance_id = p_package_instance_id)
        )
      ORDER BY e.created_at ASC
      LIMIT 1;
    END IF;
  END IF;

  IF v_id IS NULL AND p_google_event_id IS NULL AND p_session_starts_at IS NULL THEN
    SELECT e.id INTO v_id
    FROM public.cohort_lesson_log_entries e
    WHERE e.dismissed_at IS NULL
      AND e.google_event_id IS NULL
      AND e.session_starts_at IS NULL
      AND e.lesson_date = p_lesson_date
      AND (
        (p_cohort_id IS NOT NULL AND e.cohort_id = p_cohort_id)
        OR (p_package_instance_id IS NOT NULL AND e.package_instance_id = p_package_instance_id)
      )
    ORDER BY e.created_at ASC
    LIMIT 1;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.cohort_lesson_log_entries e
    WHERE e.lesson_id = p_lesson_id
      AND e.status IS DISTINCT FROM 'Cancelled'
      AND e.dismissed_at IS NULL
      AND (v_id IS NULL OR e.id <> v_id)
      AND (
        (p_cohort_id IS NOT NULL AND e.cohort_id = p_cohort_id)
        OR (p_package_instance_id IS NOT NULL AND e.package_instance_id = p_package_instance_id)
      )
  ) THEN
    RAISE EXCEPTION 'That lesson is already logged.';
  END IF;

  v_inserted := false;
  IF v_id IS NULL THEN
    BEGIN
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
      status,
      status_source,
      reviewed,
      reviewed_source,
      notes_source,
      is_cover_session,
      actual_tutor_id,
      google_event_id,
      scheduled_session_id,
      session_starts_at,
      event_timezone,
      needs_review,
      needs_review_reason,
      early_log_override_by,
      early_log_override_reason,
      early_log_overridden_at
    ) VALUES (
      p_cohort_id,
      p_package_instance_id,
      p_lesson_id,
      btrim(p_lesson_title),
      p_lesson_date,
      v_recording,
      v_notes,
      p_logged_by,
      'app',
      p_notion_page_id,
      NULLIF(btrim(COALESCE(p_notion_tutor_user_id, '')), ''),
      'pending',
      'Completed',
      'manual',
      false,
      'notion',
      CASE WHEN v_notes IS NULL THEN 'notion' ELSE 'manual' END,
      COALESCE(p_is_cover_session, false),
      p_actual_tutor_id,
      NULLIF(btrim(COALESCE(p_google_event_id, '')), ''),
      p_scheduled_session_id,
      p_session_starts_at,
      NULLIF(btrim(COALESCE(p_event_timezone, '')), ''),
      v_needs_review,
      CASE WHEN v_needs_review THEN NULLIF(btrim(COALESCE(p_needs_review_reason, '')), '') ELSE NULL END,
      CASE WHEN p_session_starts_at IS NOT NULL AND p_session_starts_at > now() THEN p_early_override_by ELSE NULL END,
      CASE WHEN p_session_starts_at IS NOT NULL AND p_session_starts_at > now()
        THEN NULLIF(btrim(COALESCE(p_early_override_reason, '')), '') ELSE NULL END,
      CASE WHEN p_session_starts_at IS NOT NULL AND p_session_starts_at > now() THEN now() ELSE NULL END
    )
    RETURNING id INTO v_id;
      v_inserted := true;
    EXCEPTION WHEN unique_violation THEN
      SELECT e.id INTO v_id
      FROM public.cohort_lesson_log_entries e
      WHERE e.dismissed_at IS NULL
        AND (
          (
            NULLIF(btrim(COALESCE(p_google_event_id, '')), '') IS NOT NULL
            AND e.google_event_id = NULLIF(btrim(COALESCE(p_google_event_id, '')), '')
          )
          OR (
            p_google_event_ids IS NOT NULL
            AND e.google_event_id IS NOT NULL
            AND e.google_event_id = ANY (p_google_event_ids)
          )
          OR (
            p_cohort_id IS NOT NULL
            AND p_session_starts_at IS NOT NULL
            AND e.cohort_id = p_cohort_id
            AND e.session_starts_at = p_session_starts_at
          )
          OR (
            p_package_instance_id IS NOT NULL
            AND p_session_starts_at IS NOT NULL
            AND e.package_instance_id = p_package_instance_id
            AND e.session_starts_at = p_session_starts_at
          )
        )
      ORDER BY e.created_at ASC
      LIMIT 1;
      IF v_id IS NULL THEN
        RAISE;
      END IF;
    END;
  END IF;

  IF NOT v_inserted THEN
    UPDATE public.cohort_lesson_log_entries
    SET
      lesson_id = p_lesson_id,
      lesson_title = btrim(p_lesson_title),
      lesson_date = p_lesson_date,
      recording_url = COALESCE(v_recording, recording_url),
      notes = COALESCE(v_notes, notes),
      logged_by = COALESCE(p_logged_by, logged_by),
      notion_page_id = COALESCE(notion_page_id, p_notion_page_id),
      notion_tutor_user_id = COALESCE(
        NULLIF(btrim(COALESCE(p_notion_tutor_user_id, '')), ''),
        notion_tutor_user_id
      ),
      is_cover_session = COALESCE(p_is_cover_session, false),
      actual_tutor_id = p_actual_tutor_id,
      google_event_id = COALESCE(google_event_id, NULLIF(btrim(COALESCE(p_google_event_id, '')), '')),
      scheduled_session_id = COALESCE(scheduled_session_id, p_scheduled_session_id),
      session_starts_at = COALESCE(session_starts_at, p_session_starts_at),
      event_timezone = COALESCE(event_timezone, NULLIF(btrim(COALESCE(p_event_timezone, '')), '')),
      needs_review = v_needs_review,
      needs_review_reason = CASE
        WHEN v_needs_review THEN NULLIF(btrim(COALESCE(p_needs_review_reason, '')), '')
        ELSE NULL
      END,
      early_log_override_by = CASE
        WHEN p_session_starts_at IS NOT NULL AND p_session_starts_at > now() THEN p_early_override_by
        ELSE early_log_override_by
      END,
      early_log_override_reason = CASE
        WHEN p_session_starts_at IS NOT NULL AND p_session_starts_at > now()
          THEN NULLIF(btrim(COALESCE(p_early_override_reason, '')), '')
        ELSE early_log_override_reason
      END,
      early_log_overridden_at = CASE
        WHEN p_session_starts_at IS NOT NULL AND p_session_starts_at > now() THEN now()
        ELSE early_log_overridden_at
      END
    WHERE id = v_id;
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(COALESCE(p_attendance, '[]'::jsonb))
  LOOP
    v_student := NULLIF(v_row->>'studentId', '')::uuid;
    v_kid := NULLIF(v_row->>'kidProfileId', '')::uuid;
    v_attended := COALESCE((v_row->>'attended')::boolean, true);

    IF p_cohort_id IS NOT NULL AND v_student IS NOT NULL THEN
      UPDATE public.cohort_lesson_attendance
      SET attended = v_attended, marked_by = p_logged_by, updated_at = now()
      WHERE cohort_id = p_cohort_id AND lesson_id = p_lesson_id AND student_id = v_student;
      IF NOT FOUND THEN
        INSERT INTO public.cohort_lesson_attendance (
          cohort_id, package_instance_id, lesson_id, student_id, kid_profile_id, attended, marked_by
        ) VALUES (
          p_cohort_id, NULL, p_lesson_id, v_student, v_kid, v_attended, p_logged_by
        );
      END IF;
    ELSIF p_cohort_id IS NOT NULL AND v_kid IS NOT NULL THEN
      UPDATE public.cohort_lesson_attendance
      SET attended = v_attended, marked_by = p_logged_by, updated_at = now()
      WHERE cohort_id = p_cohort_id AND lesson_id = p_lesson_id AND kid_profile_id = v_kid;
      IF NOT FOUND THEN
        INSERT INTO public.cohort_lesson_attendance (
          cohort_id, package_instance_id, lesson_id, student_id, kid_profile_id, attended, marked_by
        ) VALUES (
          p_cohort_id, NULL, p_lesson_id, v_student, v_kid, v_attended, p_logged_by
        );
      END IF;
    ELSIF p_package_instance_id IS NOT NULL AND v_student IS NOT NULL THEN
      UPDATE public.cohort_lesson_attendance
      SET attended = v_attended, marked_by = p_logged_by, updated_at = now()
      WHERE package_instance_id = p_package_instance_id
        AND lesson_id = p_lesson_id
        AND student_id = v_student;
      IF NOT FOUND THEN
        INSERT INTO public.cohort_lesson_attendance (
          cohort_id, package_instance_id, lesson_id, student_id, kid_profile_id, attended, marked_by
        ) VALUES (
          NULL, p_package_instance_id, p_lesson_id, v_student, v_kid, v_attended, p_logged_by
        );
      END IF;
    ELSIF p_package_instance_id IS NOT NULL AND v_kid IS NOT NULL THEN
      UPDATE public.cohort_lesson_attendance
      SET attended = v_attended, marked_by = p_logged_by, updated_at = now()
      WHERE package_instance_id = p_package_instance_id
        AND lesson_id = p_lesson_id
        AND kid_profile_id = v_kid;
      IF NOT FOUND THEN
        INSERT INTO public.cohort_lesson_attendance (
          cohort_id, package_instance_id, lesson_id, student_id, kid_profile_id, attended, marked_by
        ) VALUES (
          NULL, p_package_instance_id, p_lesson_id, v_student, v_kid, v_attended, p_logged_by
        );
      END IF;
    END IF;
  END LOOP;

  IF NOT v_needs_review THEN
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

    IF v_recording IS NOT NULL THEN
      IF p_cohort_id IS NOT NULL THEN
        INSERT INTO public.lesson_recordings (
          lesson_id, student_id, cohort_id, storage_path, uploaded_by, lesson_log_entry_id, updated_at
        ) VALUES (
          p_lesson_id, NULL, p_cohort_id, v_recording, p_logged_by, v_id, now()
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
          p_lesson_id, p_recording_student_id, NULL, v_recording, p_logged_by, v_id, now()
        )
        ON CONFLICT (lesson_id, student_id) WHERE student_id IS NOT NULL
        DO UPDATE SET
          storage_path = EXCLUDED.storage_path,
          uploaded_by = EXCLUDED.uploaded_by,
          lesson_log_entry_id = EXCLUDED.lesson_log_entry_id,
          updated_at = now();
      END IF;
    END IF;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_tutor_lesson_log(
  uuid, uuid, uuid, text, date, text, text, uuid, text, text, jsonb, uuid,
  text, text[], uuid, timestamptz, text, boolean, text, uuid, text, boolean, uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_tutor_lesson_log(
  uuid, uuid, uuid, text, date, text, text, uuid, text, text, jsonb, uuid,
  text, text[], uuid, timestamptz, text, boolean, text, uuid, text, boolean, uuid
) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_tutor_lesson_log(
  uuid, uuid, uuid, text, date, text, text, uuid, text, text, jsonb, uuid,
  text, text[], uuid, timestamptz, text, boolean, text, uuid, text, boolean, uuid
) TO service_role;

NOTIFY pgrst, 'reload schema';
