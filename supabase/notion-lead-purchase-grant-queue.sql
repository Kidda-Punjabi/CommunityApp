-- =============================================================================
-- Kidda — Queue for ambiguous/unresolvable lead Packages → access grants
-- Run in Supabase SQL Editor (project: pztubczhqkzcwtkstpgi)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.notion_lead_purchase_grant_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  notion_lead_page_id text NOT NULL,
  lead_email text,
  lead_name text,
  reason text NOT NULL,
  raw_package_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notion_lead_purchase_grant_queue_open
  ON public.notion_lead_purchase_grant_queue (created_at DESC)
  WHERE resolved = false;

CREATE INDEX IF NOT EXISTS idx_notion_lead_purchase_grant_queue_profile
  ON public.notion_lead_purchase_grant_queue (profile_id, created_at DESC);

COMMENT ON TABLE public.notion_lead_purchase_grant_queue IS
  'Ambiguous or unresolvable Notion lead Packages after signup link — admin resolves manually.';

ALTER TABLE public.notion_lead_purchase_grant_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read lead purchase grant queue"
  ON public.notion_lead_purchase_grant_queue;
CREATE POLICY "Staff read lead purchase grant queue"
  ON public.notion_lead_purchase_grant_queue FOR SELECT TO authenticated
  USING (public.is_community_lead());

DROP POLICY IF EXISTS "Staff manage lead purchase grant queue"
  ON public.notion_lead_purchase_grant_queue;
CREATE POLICY "Staff manage lead purchase grant queue"
  ON public.notion_lead_purchase_grant_queue FOR ALL TO authenticated
  USING (public.is_community_lead())
  WITH CHECK (public.is_community_lead());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notion_lead_purchase_grant_queue TO authenticated;
GRANT ALL ON public.notion_lead_purchase_grant_queue TO service_role;

NOTIFY pgrst, 'reload schema';
