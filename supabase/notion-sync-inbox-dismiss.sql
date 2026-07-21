-- =============================================================================
-- Kidda — dismiss notion_sync_inbox rows that are not real packages
-- Run in Supabase SQL Editor after notion-package-sync.sql
-- =============================================================================

ALTER TABLE public.notion_sync_inbox
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz,
  ADD COLUMN IF NOT EXISTS dismissal_reason text;

COMMENT ON COLUMN public.notion_sync_inbox.dismissed_at IS
  'Set when an inbox row is dismissed as not a real package (junk/test). Distinct from a successful package/cohort link.';

COMMENT ON COLUMN public.notion_sync_inbox.dismissal_reason IS
  'Why the inbox row was dismissed, e.g. not_a_real_package.';

NOTIFY pgrst, 'reload schema';
