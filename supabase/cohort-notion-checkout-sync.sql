-- =============================================================================
-- Kidda — Cohort fields for Notion-backed group checkout (session times + roster counts)
-- Run in Supabase SQL Editor after notion-cohort-sync.sql
-- =============================================================================

ALTER TABLE public.cohorts
  ADD COLUMN IF NOT EXISTS weekly_session_start timestamptz,
  ADD COLUMN IF NOT EXISTS weekly_session_end timestamptz,
  ADD COLUMN IF NOT EXISTS weekly_session_has_time boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notion_confirmed_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.cohorts.weekly_session_start IS
  'Weekly group session start from Notion Start Date when is_datetime is set.';
COMMENT ON COLUMN public.cohorts.weekly_session_end IS
  'Weekly group session end from Notion Start Date range when is_datetime is set.';
COMMENT ON COLUMN public.cohorts.weekly_session_has_time IS
  'True when Notion Start Date has is_datetime=1 (weekly session time entered).';
COMMENT ON COLUMN public.cohorts.notion_confirmed_count IS
  'Count of Confirmed leads on the linked Notion package page (updated on roster pull).';

NOTIFY pgrst, 'reload schema';
