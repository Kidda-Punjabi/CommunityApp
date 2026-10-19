-- Kidda — record nightly orphan-file sweeps, and list files safe to remove.
-- Run in Supabase SQL Editor (project pztubczhqkzcwtkstpgi).
-- Service role only. The sweep deletes nothing by itself; the cron does that.

CREATE TABLE IF NOT EXISTS public.data_cleanup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  dry_run boolean NOT NULL,
  files_found integer NOT NULL DEFAULT 0,
  files_deleted integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  sample_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'ok', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_data_cleanup_runs_started_at
  ON public.data_cleanup_runs (started_at DESC);

ALTER TABLE public.data_cleanup_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.data_cleanup_runs FROM anon, authenticated;
GRANT SELECT ON public.data_cleanup_runs TO authenticated;
GRANT ALL ON public.data_cleanup_runs TO service_role;

DROP POLICY IF EXISTS data_cleanup_runs_admin_read ON public.data_cleanup_runs;
CREATE POLICY data_cleanup_runs_admin_read
  ON public.data_cleanup_runs
  FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.is_master_admin());

-- Files whose path contains a kid profile id, limited to personal upload buckets.
CREATE OR REPLACE FUNCTION public.list_storage_objects_for_kid(target uuid)
RETURNS TABLE (bucket_id text, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = storage, public
AS $$
  SELECT objects.bucket_id::text, objects.name
  FROM storage.objects AS objects
  WHERE objects.bucket_id IN (
      'homework-recordings',
      'feedback-photos',
      'avatars',
      'profile-photos',
      'issue-attachments',
      'student-discount-evidence'
    )
    AND (
      objects.name = target::text
      OR objects.name LIKE target::text || '/%'
      OR objects.name LIKE '%/' || target::text || '/%'
      OR objects.name LIKE '%/' || target::text
    );
$$;

REVOKE ALL ON FUNCTION public.list_storage_objects_for_kid(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_storage_objects_for_kid(uuid) TO service_role;

-- Personal files older than 24 hours with no row still pointing at them.
-- Homework feedback audio is an orphan when the submission is gone, or when
-- tutor_feedback_audio_path no longer names that file.
CREATE OR REPLACE FUNCTION public.list_orphan_user_files(
  row_limit integer DEFAULT 500,
  row_offset integer DEFAULT 0
)
RETURNS TABLE (bucket_id text, name text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = storage, public
AS $$
  WITH orphans AS (
    SELECT objects.bucket_id::text AS bucket_id, objects.name, objects.created_at
    FROM storage.objects AS objects
    WHERE objects.created_at < now() - interval '24 hours'
      AND (
        (
          objects.bucket_id = 'homework-recordings'
          AND (
            (
              objects.name LIKE 'feedback/%'
              AND NOT EXISTS (
                SELECT 1
                FROM public.homework_submissions AS submissions
                WHERE submissions.tutor_feedback_audio_path = objects.name
              )
            )
            OR (
              objects.name NOT LIKE 'feedback/%'
              AND NOT EXISTS (
                SELECT 1
                FROM public.homework_submissions AS submissions
                WHERE submissions.storage_path = objects.name
              )
            )
          )
        )
        OR (
          objects.bucket_id IN ('avatars', 'profile-photos')
          AND split_part(objects.name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          AND NOT EXISTS (
            SELECT 1
            FROM auth.users AS users
            WHERE users.id::text = lower(split_part(objects.name, '/', 1))
          )
        )
        OR (
          objects.bucket_id = 'issue-attachments'
          AND NOT EXISTS (
            SELECT 1
            FROM public.issue_reports AS reports
            WHERE position(objects.name IN reports.attachments::text) > 0
          )
        )
        OR (
          objects.bucket_id = 'student-discount-evidence'
          AND NOT EXISTS (
            SELECT 1
            FROM public.student_discount_requests AS requests
            WHERE requests.storage_path = objects.name
          )
        )
        OR (
          objects.bucket_id = 'feedback-photos'
          AND NOT EXISTS (
            SELECT 1
            FROM public.feedback_submissions AS submissions
            WHERE submissions.picture_url IS NOT NULL
              AND position(objects.name IN submissions.picture_url) > 0
          )
        )
      )
  )
  SELECT orphans.bucket_id, orphans.name, orphans.created_at
  FROM orphans
  ORDER BY orphans.bucket_id, orphans.name
  LIMIT LEAST(GREATEST(row_limit, 0), 1000)
  OFFSET GREATEST(row_offset, 0);
$$;

REVOKE ALL ON FUNCTION public.list_orphan_user_files(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_orphan_user_files(integer, integer) TO service_role;
