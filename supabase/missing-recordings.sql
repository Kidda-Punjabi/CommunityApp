-- Missing recordings: dismiss columns, lesson-log link on uploads, cached Notion lesson databases.
-- Append-only. Safe to re-run.
--
-- Lesson log status values confirmed in production before this migration:
--   NULL (1227), Completed (29), Cancelled (1).
-- The app also allows Scheduled, which was not stored at confirmation time.
-- admin_missing_recordings excludes cancelled/void only:
--   cancelled, canceled, void, voided (case-insensitive).
-- NULL, Completed, and Scheduled stay eligible.

ALTER TABLE public.cohort_lesson_log_entries
  ADD COLUMN IF NOT EXISTS recording_dismissed_at timestamptz,
  ADD COLUMN IF NOT EXISTS recording_dismissed_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recording_dismiss_reason text,
  ADD COLUMN IF NOT EXISTS recording_dismiss_note text;

DO $$
BEGIN
  ALTER TABLE public.cohort_lesson_log_entries
    ADD CONSTRAINT cohort_lesson_log_entries_recording_dismiss_reason_check
    CHECK (
      recording_dismiss_reason IS NULL
      OR recording_dismiss_reason IN (
        'software_failed',
        'student_no_consent',
        'lesson_did_not_happen',
        'other'
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

COMMENT ON COLUMN public.cohort_lesson_log_entries.recording_dismissed_at IS
  'Admin dismissed this row from Missing recordings. Distinct from dismissed_at, which hides cancelled lesson-log rows.';

ALTER TABLE public.lesson_recordings
  ADD COLUMN IF NOT EXISTS lesson_log_entry_id uuid;

DO $$
BEGIN
  ALTER TABLE public.lesson_recordings
    ADD CONSTRAINT lesson_recordings_lesson_log_entry_id_fkey
    FOREIGN KEY (lesson_log_entry_id)
    REFERENCES public.cohort_lesson_log_entries (id)
    ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_lesson_recordings_lesson_log_entry_id
  ON public.lesson_recordings (lesson_log_entry_id)
  WHERE lesson_log_entry_id IS NOT NULL;

COMMENT ON COLUMN public.lesson_recordings.lesson_log_entry_id IS
  'Lesson log row this upload covers. Group recordings can also match on cohort_id + lesson_id.';

ALTER TABLE public.cohorts
  ADD COLUMN IF NOT EXISTS notion_lessons_data_source_id text;

ALTER TABLE public.package_instances
  ADD COLUMN IF NOT EXISTS notion_lessons_data_source_id text;

COMMENT ON COLUMN public.cohorts.notion_lessons_data_source_id IS
  'Cached Notion data source id for the package page inline lessons database.';

COMMENT ON COLUMN public.package_instances.notion_lessons_data_source_id IS
  'Cached Notion data source id for the package page inline lessons database.';

CREATE OR REPLACE FUNCTION public.assert_missing_recordings_admin()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role'
     OR current_user IN ('postgres', 'supabase_admin')
     OR public.is_admin()
     OR EXISTS (
       SELECT 1
       FROM public.profile_roles
       WHERE user_id = auth.uid()
         AND role::text = 'master_admin'
     )
  THEN
    RETURN;
  END IF;
  RAISE EXCEPTION 'Not an admin';
END;
$$;

REVOKE ALL ON FUNCTION public.assert_missing_recordings_admin() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_missing_recordings(p_include_dismissed boolean DEFAULT false)
RETURNS TABLE (
  entry_id uuid,
  kind text,
  target_name text,
  student_name text,
  tutor_name text,
  lesson_date date,
  lesson_title text,
  due_at timestamptz,
  recording_dismissed_at timestamptz,
  recording_dismissed_by uuid,
  recording_dismissed_by_name text,
  recording_dismiss_reason text,
  recording_dismiss_note text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
BEGIN
  PERFORM set_config('statement_timeout', '20s', true);
  PERFORM public.assert_missing_recordings_admin();

  RETURN QUERY
  WITH scoped AS (
    SELECT
      e.id AS entry_id,
      CASE
        WHEN e.cohort_id IS NOT NULL THEN 'group'
        ELSE 'one_to_one'
      END AS kind,
      CASE
        WHEN e.cohort_id IS NOT NULL THEN c.name
        ELSE pi.name
      END AS target_name,
      CASE
        WHEN e.cohort_id IS NULL THEN (
          SELECT string_agg(
            coalesce(
              nullif(btrim(pr.preferred_name), ''),
              nullif(btrim(pr.full_name), '')
            ),
            ', '
            ORDER BY coalesce(pr.preferred_name, pr.full_name, pr.id::text)
          )
          FROM public.student_packages sp
          JOIN public.profiles pr ON pr.id = sp.user_id
          WHERE sp.package_instance_id = e.package_instance_id
            AND sp.status::text = 'confirmed'
        )
        ELSE NULL
      END AS student_name,
      coalesce(
        nullif(btrim(tutor.preferred_name), ''),
        nullif(btrim(tutor.full_name), '')
      ) AS tutor_name,
      e.lesson_date,
      e.lesson_title,
      coalesce(
        (
          SELECT max(s.ends_at)
          FROM public.tutor_scheduled_sessions s
          WHERE s.status IS DISTINCT FROM 'cancelled'
            AND (s.starts_at AT TIME ZONE 'Europe/London')::date = e.lesson_date
            AND (
              (
                e.cohort_id IS NOT NULL
                AND s.cohort_id = e.cohort_id
                AND s.title ILIKE '%Kidda Class%'
              )
              OR (
                e.cohort_id IS NULL
                AND e.package_instance_id IS NOT NULL
                AND s.cohort_id IS NULL
                AND s.student_id IN (
                  SELECT sp.user_id
                  FROM public.student_packages sp
                  WHERE sp.package_instance_id = e.package_instance_id
                    AND sp.status::text = 'confirmed'
                )
              )
            )
        ),
        ((e.lesson_date + 1)::timestamp AT TIME ZONE 'Europe/London')
      ) + interval '24 hours' AS due_at,
      e.recording_dismissed_at,
      e.recording_dismissed_by,
      coalesce(
        nullif(btrim(dismisser.preferred_name), ''),
        nullif(btrim(dismisser.full_name), '')
      ) AS recording_dismissed_by_name,
      e.recording_dismiss_reason,
      e.recording_dismiss_note
    FROM public.cohort_lesson_log_entries e
    LEFT JOIN public.cohorts c ON c.id = e.cohort_id
    LEFT JOIN public.package_instances pi ON pi.id = e.package_instance_id
    LEFT JOIN public.profiles tutor
      ON tutor.id = CASE
        WHEN e.cohort_id IS NOT NULL THEN c.tutor_id
        ELSE pi.tutor_id
      END
    LEFT JOIN public.profiles dismisser ON dismisser.id = e.recording_dismissed_by
    WHERE (e.cohort_id IS NOT NULL OR e.package_instance_id IS NOT NULL)
      AND e.lesson_date >= (timezone('Europe/London', now()))::date - 60
      AND coalesce(
        CASE WHEN e.cohort_id IS NOT NULL THEN c.name ELSE pi.name END,
        ''
      ) NOT ILIKE 'TEST DELETE%'
      AND lower(btrim(coalesce(e.status, ''))) NOT IN (
        'cancelled',
        'canceled',
        'void',
        'voided'
      )
      AND nullif(btrim(e.recording_url), '') IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.lesson_recordings lr
        WHERE lr.lesson_log_entry_id = e.id
      )
      AND NOT (
        e.cohort_id IS NOT NULL
        AND e.lesson_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.lesson_recordings lr
          WHERE lr.cohort_id = e.cohort_id
            AND lr.lesson_id = e.lesson_id
        )
      )
      AND (
        p_include_dismissed
        OR e.recording_dismissed_at IS NULL
      )
  )
  SELECT
    scoped.entry_id,
    scoped.kind,
    scoped.target_name,
    scoped.student_name,
    scoped.tutor_name,
    scoped.lesson_date,
    scoped.lesson_title,
    scoped.due_at,
    scoped.recording_dismissed_at,
    scoped.recording_dismissed_by,
    scoped.recording_dismissed_by_name,
    scoped.recording_dismiss_reason,
    scoped.recording_dismiss_note
  FROM scoped
  WHERE scoped.due_at <= now()
  ORDER BY scoped.due_at ASC, scoped.lesson_date ASC, scoped.entry_id ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_missing_recordings_count()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total integer;
  v_one_to_one integer;
  v_group integer;
BEGIN
  PERFORM public.assert_missing_recordings_admin();

  SELECT
    count(*)::integer,
    count(*) FILTER (WHERE rows.kind = 'one_to_one')::integer,
    count(*) FILTER (WHERE rows.kind = 'group')::integer
  INTO v_total, v_one_to_one, v_group
  FROM public.admin_missing_recordings(false) AS rows;

  RETURN jsonb_build_object(
    'total', coalesce(v_total, 0),
    'one_to_one', coalesce(v_one_to_one, 0),
    'group', coalesce(v_group, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_recording_link(p_entry_id uuid, p_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_url text;
BEGIN
  PERFORM public.assert_missing_recordings_admin();
  v_url := btrim(coalesce(p_url, ''));
  IF v_url !~ '^https://[^[:space:]]+$' THEN
    RAISE EXCEPTION 'Recording URL must start with https://';
  END IF;

  UPDATE public.cohort_lesson_log_entries
  SET recording_url = v_url
  WHERE id = p_entry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lesson log entry not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_dismiss_missing_recording(
  p_entry_id uuid,
  p_reason text,
  p_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_note text;
BEGIN
  PERFORM public.assert_missing_recordings_admin();
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not an admin';
  END IF;
  IF p_reason IS NULL OR p_reason NOT IN (
    'software_failed',
    'student_no_consent',
    'lesson_did_not_happen',
    'other'
  ) THEN
    RAISE EXCEPTION 'Invalid dismiss reason';
  END IF;

  v_note := nullif(btrim(coalesce(p_note, '')), '');
  IF p_reason = 'other' AND v_note IS NULL THEN
    RAISE EXCEPTION 'A note is required when the reason is other';
  END IF;

  UPDATE public.cohort_lesson_log_entries
  SET
    recording_dismissed_at = now(),
    recording_dismissed_by = auth.uid(),
    recording_dismiss_reason = p_reason,
    recording_dismiss_note = v_note
  WHERE id = p_entry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lesson log entry not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_undismiss_missing_recording(p_entry_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.assert_missing_recordings_admin();

  UPDATE public.cohort_lesson_log_entries
  SET
    recording_dismissed_at = NULL,
    recording_dismissed_by = NULL,
    recording_dismiss_reason = NULL,
    recording_dismiss_note = NULL
  WHERE id = p_entry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lesson log entry not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_missing_recordings(boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_missing_recordings_count() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_recording_link(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_dismiss_missing_recording(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_undismiss_missing_recording(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_missing_recordings(boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_missing_recordings_count() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_recording_link(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_dismiss_missing_recording(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_undismiss_missing_recording(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
