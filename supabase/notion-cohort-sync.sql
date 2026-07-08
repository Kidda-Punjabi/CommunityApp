-- =============================================================================
-- Kidda — Notion <-> cohorts sync (read-only roster from Leads DB)
-- Run after notion-package-sync.sql and notion-package-roster.sql
-- =============================================================================

ALTER TABLE public.cohorts
  ADD COLUMN IF NOT EXISTS notion_page_id text,
  ADD COLUMN IF NOT EXISTS notion_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS notion_sync_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS notion_sync_error text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cohorts_notion_sync_status_check'
  ) THEN
    ALTER TABLE public.cohorts
      ADD CONSTRAINT cohorts_notion_sync_status_check
      CHECK (notion_sync_status IN ('pending', 'synced', 'error'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cohorts_notion_page_id
  ON public.cohorts (notion_page_id)
  WHERE notion_page_id IS NOT NULL;

COMMENT ON COLUMN public.cohorts.notion_page_id IS
  'Linked Notion page id in New Package DB for group cohort packages.';

ALTER TABLE public.notion_sync_inbox
  ADD COLUMN IF NOT EXISTS resolved_cohort_id uuid REFERENCES public.cohorts (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.notion_sync_inbox.resolved_cohort_id IS
  'Cohort created when a Notion group package row is imported.';

-- Extend roster mirror to support cohorts (table may not exist yet on all envs).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'package_instance_notion_roster'
  ) THEN
    ALTER TABLE public.package_instance_notion_roster
      ADD COLUMN IF NOT EXISTS cohort_id uuid REFERENCES public.cohorts (id) ON DELETE CASCADE;

    ALTER TABLE public.package_instance_notion_roster
      ALTER COLUMN package_instance_id DROP NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_notion_roster_cohort_lead
      ON public.package_instance_notion_roster (cohort_id, notion_lead_page_id)
      WHERE cohort_id IS NOT NULL;

    COMMENT ON TABLE public.package_instance_notion_roster IS
      'Read-only mirror of Notion Interested / Waiting for Payment / Confirmed leads for package instances and cohorts.';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
