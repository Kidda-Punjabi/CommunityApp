-- =============================================================================
-- Kidda — Admin attention for ambiguous Notion lead email matches
-- Run in Supabase SQL Editor after notion-lead-sync.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.notion_lead_link_attention (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  email text,
  lead_page_ids text[] NOT NULL DEFAULT '{}',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notion_lead_link_attention_open_profile
  ON public.notion_lead_link_attention (profile_id)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notion_lead_link_attention_open
  ON public.notion_lead_link_attention (created_at DESC)
  WHERE resolved_at IS NULL;

ALTER TABLE public.notion_lead_link_attention ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read lead link attention" ON public.notion_lead_link_attention;
CREATE POLICY "Staff read lead link attention"
  ON public.notion_lead_link_attention FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "Service role manage lead link attention" ON public.notion_lead_link_attention;
CREATE POLICY "Service role manage lead link attention"
  ON public.notion_lead_link_attention FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
