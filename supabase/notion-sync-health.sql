-- =============================================================================
-- Kidda — Notion sync health: retry queue, cron lock, run log, conflict cooldown
-- Run against project pztubczhqkzcwtkstpgi. Does not alter cohort_lesson_log_entries.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Failed Lessons Log upserts (retry every cron; do not advance watermark past these)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notion_lesson_log_sync_failures (
  notion_page_id text PRIMARY KEY,
  last_edited_time timestamptz,
  error text,
  retry_count integer NOT NULL DEFAULT 0,
  first_failed_at timestamptz NOT NULL DEFAULT now(),
  last_failed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notion_lesson_log_sync_failures_last_failed
  ON public.notion_lesson_log_sync_failures (last_failed_at DESC);

COMMENT ON TABLE public.notion_lesson_log_sync_failures IS
  'Lessons Log Notion pages whose upsert threw; retried each cron until success.';

ALTER TABLE public.notion_lesson_log_sync_failures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read lesson log sync failures"
  ON public.notion_lesson_log_sync_failures;
CREATE POLICY "Staff read lesson log sync failures"
  ON public.notion_lesson_log_sync_failures FOR SELECT TO authenticated
  USING (public.is_community_lead());

GRANT SELECT ON public.notion_lesson_log_sync_failures TO authenticated;
GRANT ALL ON public.notion_lesson_log_sync_failures TO service_role;

-- ---------------------------------------------------------------------------
-- Cron overlap lock
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notion_sync_locks (
  name text PRIMARY KEY,
  holder text NOT NULL,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

COMMENT ON TABLE public.notion_sync_locks IS
  'Single-row lock so /api/cron/notion-sync skips if a previous run is still in flight.';

ALTER TABLE public.notion_sync_locks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.notion_sync_locks FROM authenticated, anon;
GRANT ALL ON public.notion_sync_locks TO service_role;
GRANT SELECT ON public.notion_sync_locks TO authenticated;

DROP POLICY IF EXISTS "Staff read notion sync locks" ON public.notion_sync_locks;
CREATE POLICY "Staff read notion sync locks"
  ON public.notion_sync_locks FOR SELECT TO authenticated
  USING (public.is_community_lead());

CREATE OR REPLACE FUNCTION public.try_acquire_notion_sync_lock(
  p_name text,
  p_holder text,
  p_ttl_seconds integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated integer;
BEGIN
  INSERT INTO public.notion_sync_locks (name, holder, acquired_at, expires_at)
  VALUES (
    p_name,
    p_holder,
    now(),
    now() + make_interval(secs => GREATEST(p_ttl_seconds, 1))
  )
  ON CONFLICT (name) DO UPDATE
    SET holder = EXCLUDED.holder,
        acquired_at = EXCLUDED.acquired_at,
        expires_at = EXCLUDED.expires_at
    WHERE public.notion_sync_locks.expires_at < now();

  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_notion_sync_lock(
  p_name text,
  p_holder text
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.notion_sync_locks
  WHERE name = p_name AND holder = p_holder;
$$;

REVOKE ALL ON FUNCTION public.try_acquire_notion_sync_lock(text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_notion_sync_lock(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_acquire_notion_sync_lock(text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_notion_sync_lock(text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- Cron run history (Sync Health panel)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notion_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  outcome text NOT NULL DEFAULT 'running',
  skipped_overlap boolean NOT NULL DEFAULT false,
  steps jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text
);

CREATE INDEX IF NOT EXISTS idx_notion_sync_runs_started
  ON public.notion_sync_runs (started_at DESC);

COMMENT ON TABLE public.notion_sync_runs IS
  'One row per /api/cron/notion-sync invocation, including overlap skips.';

ALTER TABLE public.notion_sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read notion sync runs" ON public.notion_sync_runs;
CREATE POLICY "Staff read notion sync runs"
  ON public.notion_sync_runs FOR SELECT TO authenticated
  USING (public.is_community_lead());

GRANT SELECT ON public.notion_sync_runs TO authenticated;
GRANT ALL ON public.notion_sync_runs TO service_role;

-- ---------------------------------------------------------------------------
-- Lead-link conflicts: resolved cooldown (one open row per profile)
-- ---------------------------------------------------------------------------

ALTER TABLE public.notion_lead_link_conflicts
  ADD COLUMN IF NOT EXISTS resolved boolean NOT NULL DEFAULT false;

ALTER TABLE public.notion_lead_link_conflicts
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY profile_id ORDER BY created_at ASC, id ASC) AS rn
  FROM public.notion_lead_link_conflicts
  WHERE resolved = false
)
UPDATE public.notion_lead_link_conflicts c
SET
  resolved = true,
  resolved_at = COALESCE(c.resolved_at, now())
FROM ranked r
WHERE c.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notion_lead_link_conflicts_one_open
  ON public.notion_lead_link_conflicts (profile_id)
  WHERE resolved = false;

DROP POLICY IF EXISTS "Staff manage lead link conflicts" ON public.notion_lead_link_conflicts;
CREATE POLICY "Staff manage lead link conflicts"
  ON public.notion_lead_link_conflicts FOR ALL TO authenticated
  USING (public.is_community_lead())
  WITH CHECK (public.is_community_lead());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notion_lead_link_conflicts TO authenticated;

NOTIFY pgrst, 'reload schema';
