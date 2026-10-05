-- =============================================================================
-- Kidda — Meta ad spend sync tables
-- Admins read. Service role writes (RLS bypass). No client writes.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.meta_ad_spend_daily (
  date date NOT NULL,
  ad_account_id text,
  campaign_id text,
  campaign_name text,
  adset_id text,
  adset_name text,
  ad_id text NOT NULL,
  ad_name text,
  spend numeric(12, 2) NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  meta_leads integer NOT NULL DEFAULT 0,
  currency text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meta_ad_spend_daily_date_ad_id_key UNIQUE (date, ad_id)
);

COMMENT ON TABLE public.meta_ad_spend_daily IS
  'Daily Meta ads insights at ad level. Written by the meta-ads-sync edge function.';

COMMENT ON COLUMN public.meta_ad_spend_daily.meta_leads IS
  'Sum of actions where action_type = lead.';

CREATE TABLE IF NOT EXISTS public.meta_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL,
  date_from date,
  date_to date,
  rows_upserted integer NOT NULL DEFAULT 0,
  error text,
  CONSTRAINT meta_sync_runs_status_check CHECK (status IN ('success', 'error'))
);

COMMENT ON TABLE public.meta_sync_runs IS
  'One row per meta-ads-sync run. error is stored with the access token stripped.';

CREATE INDEX IF NOT EXISTS meta_sync_runs_started_at_idx
  ON public.meta_sync_runs (started_at DESC);

ALTER TABLE public.meta_ad_spend_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read meta ad spend" ON public.meta_ad_spend_daily;
CREATE POLICY "Admins read meta ad spend"
  ON public.meta_ad_spend_daily
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Admins read meta sync runs" ON public.meta_sync_runs;
CREATE POLICY "Admins read meta sync runs"
  ON public.meta_sync_runs
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_admin()));

REVOKE ALL ON public.meta_ad_spend_daily FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.meta_sync_runs FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.meta_ad_spend_daily TO authenticated;
GRANT SELECT ON public.meta_sync_runs TO authenticated;
GRANT ALL ON public.meta_ad_spend_daily TO service_role;
GRANT ALL ON public.meta_sync_runs TO service_role;

NOTIFY pgrst, 'reload schema';
