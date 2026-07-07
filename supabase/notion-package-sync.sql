-- =============================================================================
-- Kidda — Notion <-> package_instances two-way sync support
-- Run in Supabase SQL Editor (project: pztubczhqkzcwtkstpgi)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- package_instances: Notion sync metadata
-- ---------------------------------------------------------------------------

ALTER TABLE public.package_instances
  ADD COLUMN IF NOT EXISTS notion_page_id text,
  ADD COLUMN IF NOT EXISTS notion_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS notion_sync_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS notion_sync_error text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'package_instances_notion_sync_status_check'
  ) THEN
    ALTER TABLE public.package_instances
      ADD CONSTRAINT package_instances_notion_sync_status_check
      CHECK (notion_sync_status IN ('pending', 'synced', 'error'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_package_instances_notion_page_id
  ON public.package_instances (notion_page_id)
  WHERE notion_page_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_package_instances_notion_sync_status
  ON public.package_instances (notion_sync_status)
  WHERE notion_sync_status <> 'synced';

COMMENT ON COLUMN public.package_instances.notion_page_id IS
  'Linked Notion page id in New Package DB. Set on first successful push.';

-- ---------------------------------------------------------------------------
-- notion_tutor_map: Supabase tutor <-> Notion user
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notion_tutor_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  notion_user_id text NOT NULL,
  notion_user_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notion_tutor_map_tutor_id_key UNIQUE (tutor_id),
  CONSTRAINT notion_tutor_map_notion_user_id_key UNIQUE (notion_user_id)
);

CREATE INDEX IF NOT EXISTS idx_notion_tutor_map_tutor_id
  ON public.notion_tutor_map (tutor_id);

COMMENT ON TABLE public.notion_tutor_map IS
  'Maps app tutor profiles to Notion people ids for package sync Tutor property.';

-- ---------------------------------------------------------------------------
-- notion_sync_inbox: packages created in Notion awaiting app linkage
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notion_sync_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id text NOT NULL,
  package_name text,
  start_date timestamptz,
  end_date timestamptz,
  status text,
  notion_tutor_user_id text,
  raw_properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  resolved_package_instance_id uuid REFERENCES public.package_instances (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notion_sync_inbox_notion_page_id_key UNIQUE (notion_page_id)
);

CREATE INDEX IF NOT EXISTS idx_notion_sync_inbox_unresolved
  ON public.notion_sync_inbox (created_at DESC)
  WHERE resolved = false;

COMMENT ON TABLE public.notion_sync_inbox IS
  'Notion-only package rows pending manual package_id/course_id linkage in admin.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.notion_tutor_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notion_sync_inbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read notion tutor map" ON public.notion_tutor_map;
CREATE POLICY "Staff read notion tutor map"
  ON public.notion_tutor_map FOR SELECT TO authenticated
  USING (public.is_community_lead());

DROP POLICY IF EXISTS "Staff manage notion tutor map" ON public.notion_tutor_map;
CREATE POLICY "Staff manage notion tutor map"
  ON public.notion_tutor_map FOR ALL TO authenticated
  USING (public.is_community_lead())
  WITH CHECK (public.is_community_lead());

DROP POLICY IF EXISTS "Staff read notion sync inbox" ON public.notion_sync_inbox;
CREATE POLICY "Staff read notion sync inbox"
  ON public.notion_sync_inbox FOR SELECT TO authenticated
  USING (public.is_community_lead());

DROP POLICY IF EXISTS "Staff manage notion sync inbox" ON public.notion_sync_inbox;
CREATE POLICY "Staff manage notion sync inbox"
  ON public.notion_sync_inbox FOR ALL TO authenticated
  USING (public.is_community_lead())
  WITH CHECK (public.is_community_lead());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notion_tutor_map TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notion_sync_inbox TO authenticated;
GRANT ALL ON public.notion_tutor_map TO service_role;
GRANT ALL ON public.notion_sync_inbox TO service_role;

-- =============================================================================
-- Webhook setup (Supabase Dashboard → Database → Webhooks):
--   1. package_instances INSERT/UPDATE → POST /api/notion-sync/push-package-instance
--      Header: x-notion-sync-secret = NOTION_SYNC_WEBHOOK_SECRET
--   2. profiles INSERT → POST /api/notion-sync/link-profile-lead
--      Header: x-notion-sync-secret = NOTION_SYNC_WEBHOOK_SECRET
-- =============================================================================

NOTIFY pgrst, 'reload schema';
