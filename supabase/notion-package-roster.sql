-- =============================================================================
-- Kidda — Notion package roster (read-only mirror of Interested / Confirmed leads)
-- Run in Supabase SQL Editor after notion-package-sync.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.package_instance_notion_roster (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_instance_id uuid NOT NULL REFERENCES public.package_instances (id) ON DELETE CASCADE,
  notion_lead_page_id text NOT NULL,
  lead_name text NOT NULL,
  lead_email text,
  roster_status text NOT NULL
    CHECK (roster_status IN ('interested', 'waiting_for_payment', 'confirmed')),
  profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  student_package_id uuid REFERENCES public.student_packages (id) ON DELETE SET NULL,
  synced_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT package_instance_notion_roster_instance_lead_key
    UNIQUE (package_instance_id, notion_lead_page_id)
);

CREATE INDEX IF NOT EXISTS idx_package_instance_notion_roster_instance
  ON public.package_instance_notion_roster (package_instance_id);

CREATE INDEX IF NOT EXISTS idx_package_instance_notion_roster_lead
  ON public.package_instance_notion_roster (notion_lead_page_id);

COMMENT ON TABLE public.package_instance_notion_roster IS
  'Read-only mirror of Notion package Interested / Waiting for Payment / Confirmed lead relations. Never written back to Notion.';

ALTER TABLE public.package_instance_notion_roster ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read package notion roster" ON public.package_instance_notion_roster;
CREATE POLICY "Staff read package notion roster"
  ON public.package_instance_notion_roster FOR SELECT TO authenticated
  USING (public.is_community_lead());

DROP POLICY IF EXISTS "Staff manage package notion roster" ON public.package_instance_notion_roster;
CREATE POLICY "Staff manage package notion roster"
  ON public.package_instance_notion_roster FOR ALL TO authenticated
  USING (public.is_community_lead())
  WITH CHECK (public.is_community_lead());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_instance_notion_roster TO authenticated;
GRANT ALL ON public.package_instance_notion_roster TO service_role;

NOTIFY pgrst, 'reload schema';
