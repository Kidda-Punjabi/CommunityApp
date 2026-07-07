-- =============================================================================
-- Kidda — Notion Leads Database <-> profiles identity linking
-- Run in Supabase SQL Editor (project: pztubczhqkzcwtkstpgi)
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notion_lead_page_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_notion_lead_page_id
  ON public.profiles (notion_lead_page_id)
  WHERE notion_lead_page_id IS NOT NULL;

COMMENT ON COLUMN public.profiles.notion_lead_page_id IS
  'Linked Notion Leads Database page id (set by automatic email match).';

-- ---------------------------------------------------------------------------
-- Conflict log (two Leads rows claiming the same profile)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notion_lead_link_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  existing_notion_page_id text NOT NULL,
  attempted_notion_page_id text NOT NULL,
  lead_email text,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notion_lead_link_conflicts_profile
  ON public.notion_lead_link_conflicts (profile_id, created_at DESC);

COMMENT ON TABLE public.notion_lead_link_conflicts IS
  'Logged when a second Notion lead row matches a profile that is already linked.';

ALTER TABLE public.notion_lead_link_conflicts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read lead link conflicts" ON public.notion_lead_link_conflicts;
CREATE POLICY "Staff read lead link conflicts"
  ON public.notion_lead_link_conflicts FOR SELECT TO authenticated
  USING (public.is_community_lead());

GRANT SELECT ON public.notion_lead_link_conflicts TO authenticated;
GRANT ALL ON public.notion_lead_link_conflicts TO service_role;

NOTIFY pgrst, 'reload schema';
