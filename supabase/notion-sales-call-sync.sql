-- =============================================================================
-- Kidda — Notion Sales Call Log <-> sales_calls two-way sync
-- Run in Supabase SQL Editor (project: pztubczhqkzcwtkstpgi)
-- Database ID (API): 293b5ac4-29c6-80d0-9f48-c5833fd1ea1b
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.sales_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notes text,
  call_date timestamptz,
  lead_notion_page_id text,
  user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  outcome text,
  sales_mechanism text,
  call_length numeric,
  ranking text,
  course text,
  delivery text,
  tutor_select text,
  tutor_person_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  show_up boolean NOT NULL DEFAULT false,
  offer boolean NOT NULL DEFAULT false,
  closed boolean NOT NULL DEFAULT false,
  payment_made boolean NOT NULL DEFAULT false,
  payment_date timestamptz,
  cash_on_call numeric,
  paid_afterwards numeric,
  outstanding_balance numeric,
  status text,
  commission_amount numeric,
  commission_paid boolean NOT NULL DEFAULT false,
  commission_valid boolean NOT NULL DEFAULT false,
  calendar_invite boolean NOT NULL DEFAULT false,
  welcome_email boolean NOT NULL DEFAULT false,
  whatsapp_chat_made boolean NOT NULL DEFAULT false,
  schedule_whatsapp_group boolean NOT NULL DEFAULT false,
  tutor_notified boolean NOT NULL DEFAULT false,
  time_assigned boolean NOT NULL DEFAULT false,
  package_created boolean NOT NULL DEFAULT false,
  offboarded boolean NOT NULL DEFAULT false,
  offboarded_1 boolean NOT NULL DEFAULT false,
  notion_page_id text,
  notion_synced_at timestamptz,
  notion_sync_status text NOT NULL DEFAULT 'pending',
  notion_sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_calls_notion_page_id_key UNIQUE (notion_page_id),
  CONSTRAINT sales_calls_notion_sync_status_check
    CHECK (notion_sync_status IN ('pending', 'synced', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_sales_calls_call_date
  ON public.sales_calls (call_date DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_sales_calls_lead_notion_page_id
  ON public.sales_calls (lead_notion_page_id)
  WHERE lead_notion_page_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_calls_user_id
  ON public.sales_calls (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_calls_outcome
  ON public.sales_calls (outcome);

CREATE INDEX IF NOT EXISTS idx_sales_calls_status
  ON public.sales_calls (status);

CREATE INDEX IF NOT EXISTS idx_sales_calls_notion_sync_status
  ON public.sales_calls (notion_sync_status)
  WHERE notion_sync_status <> 'synced';

COMMENT ON TABLE public.sales_calls IS
  'Sales call log entries synced with Notion Sales Call Log (293b5ac4-29c6-80d0-9f48-c5833fd1ea1b).';

CREATE TABLE IF NOT EXISTS public.notion_leads_cache (
  notion_page_id text PRIMARY KEY,
  name text,
  email text,
  phone text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notion_leads_cache_name
  ON public.notion_leads_cache (name);

CREATE INDEX IF NOT EXISTS idx_notion_leads_cache_email
  ON public.notion_leads_cache (email);

COMMENT ON TABLE public.notion_leads_cache IS
  'Read-only mirror of Notion Leads Database Name/Email/Phone for admin typeahead.';

CREATE OR REPLACE FUNCTION public.set_sales_calls_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_calls_updated_at ON public.sales_calls;
CREATE TRIGGER trg_sales_calls_updated_at
  BEFORE UPDATE ON public.sales_calls
  FOR EACH ROW
  EXECUTE FUNCTION public.set_sales_calls_updated_at();

ALTER TABLE public.sales_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notion_leads_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read sales calls" ON public.sales_calls;
CREATE POLICY "Staff read sales calls"
  ON public.sales_calls FOR SELECT TO authenticated
  USING (public.is_community_lead());

DROP POLICY IF EXISTS "Staff manage sales calls" ON public.sales_calls;
CREATE POLICY "Staff manage sales calls"
  ON public.sales_calls FOR ALL TO authenticated
  USING (public.is_community_lead())
  WITH CHECK (public.is_community_lead());

DROP POLICY IF EXISTS "Staff read notion leads cache" ON public.notion_leads_cache;
CREATE POLICY "Staff read notion leads cache"
  ON public.notion_leads_cache FOR SELECT TO authenticated
  USING (public.is_community_lead());

DROP POLICY IF EXISTS "Staff manage notion leads cache" ON public.notion_leads_cache;
CREATE POLICY "Staff manage notion leads cache"
  ON public.notion_leads_cache FOR ALL TO authenticated
  USING (public.is_community_lead())
  WITH CHECK (public.is_community_lead());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_calls TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notion_leads_cache TO authenticated;
GRANT ALL ON public.sales_calls TO service_role;
GRANT ALL ON public.notion_leads_cache TO service_role;

-- =============================================================================
-- Webhook setup (Supabase Dashboard → Database → Webhooks):
--   sales_calls INSERT/UPDATE → POST /api/notion-sync/push-sales-call
--   Header: x-notion-sync-secret = NOTION_SYNC_WEBHOOK_SECRET
-- =============================================================================

NOTIFY pgrst, 'reload schema';
